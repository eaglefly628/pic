if(!window.parent?.PicRuntime){location.replace('/pic/');throw Error('请从家庭 PIC 入口解锁');}
window.parent.PicRuntime.install(window);

const originalFetch=window.fetch.bind(window);
window.fetch=(input,options)=>{const url=new URL(typeof input==='string'?input:input.url,location.origin);if(url.origin===location.origin&&/^\/api\/(?:pic\/legacy\/)?health\//.test(url.pathname))return window.parent.PicRuntime.healthFetch(input,options);if(url.origin===location.origin&&url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/pic/'))return originalFetch('/api/pic/legacy'+url.pathname.slice(4)+url.search,options);return originalFetch(input,options);};
