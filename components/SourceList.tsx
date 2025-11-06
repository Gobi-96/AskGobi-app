export default function SourceList({ sources }:{ sources: {title:string,url:string}[] }){
  if(!sources?.length) return null;
  return (
    <ul className="mt-2 text-sm text-gray-400 space-y-1">
      {sources.map((s, i) => (
        <li key={i}>
          <span className="mr-1">[{i+1}]</span>
          <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
        </li>
      ))}
    </ul>
  );
}
