/** New production amounts use nanounits; existing saved balances are never rounded.
 * Decimal addition/subtraction uses the serialized decimal values, avoiding binary
 * cancellation tails while keeping legacy fractions (including very small ones).
 */
export const RESOURCE_ACCOUNTING_VERSION='resource-amounts:decimal-9:v1';
export const RESOURCE_DECIMAL_PLACES=9;
function decimal(value){
 if(!Number.isFinite(value))throw Error('物资数量必须为有限数。');
 const [mantissa,exponent='0']=String(value).toLowerCase().split('e');
 const negative=mantissa.startsWith('-'),unsigned=negative?mantissa.slice(1):mantissa;
 const [whole,fraction='']=unsigned.split('.');
 let units=BigInt(whole+fraction)*(negative?-1n:1n),scale=fraction.length-Number(exponent);
 if(scale<0){units*=10n**BigInt(-scale);scale=0;}
 return {units,scale};
}
function number({units,scale}){
 const negative=units<0n;let digits=String(negative?-units:units);
 if(scale){digits=digits.padStart(scale+1,'0');digits=digits.slice(0,-scale)+'.'+digits.slice(-scale);}
 const result=Number((negative?'-':'')+digits);
 if(!Number.isFinite(result))throw Error('物资数量超出有限范围。');
 return result===0?0:result;
}
export function addAmounts(...values){
 const parts=values.map(decimal),scale=Math.max(0,...parts.map(p=>p.scale));
 return number({scale,units:parts.reduce((sum,p)=>sum+p.units*10n**BigInt(scale-p.scale),0n)});
}
export const subtractAmounts=(balance,amount)=>addAmounts(balance,-amount);
/** Round only newly calculated production/wage amounts, once after aggregation. */
export function productionAmount(value){
 if(value<0)throw Error('生产数量不能为负数。');
 const p=decimal(value);
 if(p.scale<=RESOURCE_DECIMAL_PLACES)return value;
 const divisor=10n**BigInt(p.scale-RESOURCE_DECIMAL_PLACES);
 return number({scale:RESOURCE_DECIMAL_PLACES,units:(p.units+divisor/2n)/divisor});
}
export function productionAmounts(amounts){
 return Object.fromEntries(Object.entries(amounts).map(([key,value])=>[key,productionAmount(value)]).filter(([,value])=>value>0));
}
export const canonicalProductionAmount=value=>Number.isFinite(value)&&value>=0&&productionAmount(value)===value;
