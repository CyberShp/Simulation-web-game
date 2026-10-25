import Foundation
import AVFoundation
import CoreMedia
import CryptoKit

func fail(_ message:String) -> NSError { NSError(domain:"SilentRemux",code:1,userInfo:[NSLocalizedDescriptionKey:message]) }
func hashData(_ data:Data) -> String { SHA256.hash(data:data).map{String(format:"%02x",$0)}.joined() }
func fileHash(_ url:URL) throws -> String { hashData(try Data(contentsOf:url)) }

struct VideoPackets {
    let hash:String
    let hashes:[String]
    let sizes:[Int]
    let times:[Double]
}
func compressedPackets(_ asset:AVAsset,_ track:AVAssetTrack) throws -> VideoPackets {
    let reader=try AVAssetReader(asset:asset)
    let output=AVAssetReaderTrackOutput(track:track,outputSettings:nil)
    output.alwaysCopiesSampleData=false
    guard reader.canAdd(output) else { throw fail("Cannot attach compressed video reader") }
    reader.add(output)
    guard reader.startReading() else { throw reader.error ?? fail("Cannot read video packets") }
    var aggregate=SHA256(), hashes=[String](), sizes=[Int](), times=[Double]()
    while let sample=output.copyNextSampleBuffer() {
        guard let block=CMSampleBufferGetDataBuffer(sample) else {
            if CMSampleBufferGetTotalSampleSize(sample)==0 && CMSampleBufferGetImageBuffer(sample)==nil { continue }
            throw fail("Video sample has no compressed data: samples=\(CMSampleBufferGetNumSamples(sample)),bytes=\(CMSampleBufferGetTotalSampleSize(sample)),image=\(CMSampleBufferGetImageBuffer(sample) != nil)")
        }
        let length=CMBlockBufferGetDataLength(block)
        guard length>0 else { throw fail("Empty compressed sample") }
        var bytes=[UInt8](repeating:0,count:length)
        let status=bytes.withUnsafeMutableBytes { CMBlockBufferCopyDataBytes(block,atOffset:0,dataLength:length,destination:$0.baseAddress!) }
        guard status==kCMBlockBufferNoErr else { throw fail("Cannot copy compressed sample bytes") }
        let data=Data(bytes);aggregate.update(data:data);hashes.append(hashData(data));sizes.append(length)
        times.append(CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sample)))
    }
    guard reader.status == .completed, !hashes.isEmpty else { throw reader.error ?? fail("Compressed video reader did not complete with video packets") }
    return VideoPackets(hash:aggregate.finalize().map{String(format:"%02x",$0)}.joined(),hashes:hashes,sizes:sizes,times:times)
}

do {
    guard CommandLine.arguments.count==4 else { throw fail("Usage: silent-remux source.mp4 silent-source.mp4 report.json") }
    let sourceURL=URL(fileURLWithPath:CommandLine.arguments[1]), destination=URL(fileURLWithPath:CommandLine.arguments[2]), reportURL=URL(fileURLWithPath:CommandLine.arguments[3])
    guard !FileManager.default.fileExists(atPath:destination.path), !FileManager.default.fileExists(atPath:reportURL.path) else { throw fail("Existing output is protected") }
    let sourceHash=try fileHash(sourceURL), source=AVURLAsset(url:sourceURL)
    guard let video=source.tracks(withMediaType:.video).first else { throw fail("Source has no video track") }
    let before=try compressedPackets(source,video)
    let composition=AVMutableComposition()
    guard let target=composition.addMutableTrack(withMediaType:.video,preferredTrackID:kCMPersistentTrackID_Invalid) else { throw fail("Cannot create video-only track") }
    try target.insertTimeRange(video.timeRange,of:video,at:video.timeRange.start)
    target.preferredTransform=video.preferredTransform
    guard let session=AVAssetExportSession(asset:composition,presetName:AVAssetExportPresetPassthrough) else { throw fail("Passthrough export unavailable") }
    session.outputURL=destination;session.outputFileType = .mp4;session.shouldOptimizeForNetworkUse=false
    let semaphore=DispatchSemaphore(value:0)
    session.exportAsynchronously { semaphore.signal() }
    guard semaphore.wait(timeout:.now()+60) == .success else { throw fail("Passthrough export timed out") }
    guard session.status == .completed else { throw session.error ?? fail("Passthrough export failed") }
    let result=AVURLAsset(url:destination), audioCount=result.tracks(withMediaType:.audio).count
    guard result.tracks(withMediaType:.video).count==1, let resultVideo=result.tracks(withMediaType:.video).first, audioCount==0 else { throw fail("Output track counts are wrong") }
    let after=try compressedPackets(result,resultVideo)
    guard before.hashes==after.hashes, before.sizes==after.sizes, before.hash==after.hash else { throw fail("Compressed video payload changed") }
    let timeDelta=zip(before.times,after.times).map{abs($0-$1)}.max() ?? 0
    guard timeDelta<1e-9, try fileHash(sourceURL)==sourceHash else { throw fail("Source or video presentation times changed") }
    let report:[String:Any]=[
        "source":sourceURL.path,"output":destination.path,"method":"AVFoundation video-only AVAssetExportPresetPassthrough",
        "sourceSha256":sourceHash,"outputSha256":try fileHash(destination),"sourceUnchanged":true,
        "sourceAudioTracks":source.tracks(withMediaType:.audio).count,"outputAudioTracks":audioCount,"outputVideoTracks":1,
        "videoSamples":before.hashes.count,"sourceVideoPayloadSha256":before.hash,"outputVideoPayloadSha256":after.hash,
        "allCompressedSampleHashesEqual":true,"sampleSizesEqual":true,"maximumPtsDifferenceSeconds":timeDelta,
        "durationSeconds":CMTimeGetSeconds(result.duration),"nativeWidth":resultVideo.naturalSize.width,"nativeHeight":resultVideo.naturalSize.height,
        "compressedSampleSha256":before.hashes,"status":"silent video verified; no video re-encoding"
    ]
    try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:reportURL,options:.withoutOverwriting)
    print(String(data:try JSONSerialization.data(withJSONObject:["output":destination.path,"report":reportURL.path,"audioTracks":audioCount,"videoSamples":before.hashes.count,"payloadEqual":true]),encoding:.utf8)!)
} catch {
    FileHandle.standardError.write(Data(("silent-remux: \(error)\n").utf8));exit(1)
}
