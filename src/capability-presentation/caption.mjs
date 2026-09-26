export function identifierCaption(value,context){
 const omitted=new Set(context.split(/[-_.]/).filter(w=>w.length>3));
 return value.replace(/\.v\d+$/,'').split(/[-_.]/).filter((w,i,a)=>!['sda','authority'].includes(w)&&(i===0||i===a.length-1||!omitted.has(w))).join(' ').replace(/(\d)([a-z])/g,'$1 $2');
}
