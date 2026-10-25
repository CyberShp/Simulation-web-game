# 剑气样板音效

8个原创程序合成单音，48kHz、单声道16-bit PCM。合辑 `audition.wav` 共6.72秒，每种两遍，组间0.3秒；顺序见 `metadata.json`。

顺序：剑气离手、轻命中、Q蓄势、Q命中、闪避衣风、敌落拳、玩家受击、空地落刃。工程峰值、RMS、削波计数、种子及散列随元数据保存。音源仅由振荡器和滤波伪随机噪声产生。听感待实际试听；峰值数据只说明电平。

```js
// 构建器读取 audio-data.json 为 AUDIO_DATA，并内嵌模块（去掉 export）。
const audio = createRangedAudio({ assets: AUDIO_DATA, volume: 0.35 });
audio.sync(game.snapshot()); // 建立初始基线
// 用户手势中调用，不等待音频加载来执行游戏输入。
void audio.unlock();
audio.sync(game.snapshot()); // 每帧只消费新事件
audio.setMuted(true);
audio.setVolume(0.35);
// R: 先 game.reset()，随后同步停止音源并进入新epoch。
audio.reset(game.snapshot().epoch);
```

`audio-data.json` 使用WAV data URI，适配直接打开的本地HTML。播放模块不发网络请求，不使用游戏存档；音量只控制该模块的GainNode。首次同步、被动发现epoch变化或时钟回退时只建立基线。事件须有本代单调递增的数字 `id`；超过120ms的历史事件、锁定/未就绪/静音期间的事件均被消费并跳过，不排队补播。

主增益后接DynamicsCompressor：threshold −6dB、knee 0、ratio 20:1、attack 1ms、release 60ms，限制多声部重叠峰值。默认0.35音量下单音最大约0.259，低于其阈值。该节点提供混音减峰保护，不能把单音削波计数当成实际浏览器混音或听感验收。

事件映射：`projectile-release`→离手；`enemy-hit(kind)`→轻/重命中；`heavy-start`→蓄势；`heavy-land(hit:false)`→空地落刃；`dodge`→衣风；`enemy-swing`→落拳；`player-hit`→受击。命中的落刃由对应 `enemy-hit` 发音。R停止活动音源并清除去重游标；解锁后的已解码资源继续复用。

重建命令：`python3 -B scripts/art/combat-direction-study/ranged_sfx.py --check` 只读核对确定性输出；新目录生成时使用 `--output`。试听判定与页面实际输出另记。
