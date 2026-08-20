(() => {
  'use strict';

  const TMDB_PROXY_URL='https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';
  const nativeFetch=window.fetch.bind(window);
  const aliasCache=new Map();

  const clean=value=>String(value||'')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s·•:：—–\-_'"“”‘’.,，。!！?？()（）\[\]【】]/g,'');

  function requestMeta(input,init){
    const url=typeof input==='string'?input:(input instanceof URL?input.href:input?.url||'');
    if(url!==TMDB_PROXY_URL) return null;
    const body=init?.body;
    if(typeof body!=='string') return null;
    try{
      const parsed=JSON.parse(body);
      const path=String(parsed?.path||'');
      if(!['/search/multi','/search/movie','/search/tv'].includes(path)) return null;
      const query=String(parsed?.params?.query||'').trim();
      return query?{path,query}:null;
    }catch{return null}
  }

  function candidateType(item,path){
    if(item?.media_type==='movie'||item?.media_type==='tv') return item.media_type;
    return path==='/search/tv'?'tv':'movie';
  }

  function candidateNames(item,type){
    return type==='tv'
      ? [item?.name,item?.original_name]
      : [item?.title,item?.original_title];
  }

  async function aliasesFor(item,type){
    const id=String(item?.id||'');
    if(!id) return [];
    const key=`${type}:${id}`;
    if(aliasCache.has(key)) return aliasCache.get(key);
    const task=(async()=>{
      try{
        const path=`/${type}/${id}/alternative_titles`;
        const res=await nativeFetch(TMDB_PROXY_URL,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({path,params:{}})
        });
        if(!res.ok) return [];
        const data=await res.json();
        const rows=type==='tv'?(data?.results||[]):(data?.titles||[]);
        return [...new Set(rows.map(x=>String(x?.title||'').trim()).filter(Boolean))];
      }catch{return []}
    })();
    aliasCache.set(key,task);
    return task;
  }

  async function enrichSearchResponse(response,meta){
    if(!response?.ok) return response;
    let data;
    try{data=await response.clone().json()}catch{return response}
    if(!Array.isArray(data?.results)||!data.results.length) return response;

    const q=clean(meta.query);
    if(!q) return response;

    const direct=data.results.some(item=>{
      const type=candidateType(item,meta.path);
      return candidateNames(item,type).some(name=>clean(name)===q);
    });
    if(direct) return response;

    const candidates=data.results
      .filter(item=>['movie','tv'].includes(candidateType(item,meta.path)))
      .slice(0,8);

    await Promise.all(candidates.map(async item=>{
      const type=candidateType(item,meta.path);
      const aliases=await aliasesFor(item,type);
      if(!aliases.some(alias=>clean(alias)===q)) return;
      // 仅给本次搜索结果附加“命中的别名”，用于现有精确匹配逻辑。
      // 真正写入影视库时仍会重新拉取 TMDb 详情，因此不会污染正式片名。
      if(type==='tv') item.name=meta.query;
      else item.title=meta.query;
      item.__matchedAlternativeTitle=meta.query;
    }));

    const headers=new Headers(response.headers);
    headers.delete('content-length');
    return new Response(JSON.stringify(data),{
      status:response.status,
      statusText:response.statusText,
      headers
    });
  }

  window.fetch=async function(input,init){
    const meta=requestMeta(input,init);
    const response=await nativeFetch(input,init);
    if(!meta) return response;
    try{return await enrichSearchResponse(response,meta)}catch{return response}
  };
})();
