import Link from "next/link";

export interface HeatRisk { id: number; ref: string; title: string; l: number; i: number }

const IMPACT = ["Minor", "Moderate", "Major", "Severe", "Extreme"];
const LIKELIHOOD = ["Rare", "Unlikely", "Possible", "Likely", "Almost certain"];

function cellClass(s: number) {
  if (s >= 15) return "bg-crit text-white";
  if (s >= 10) return "bg-bad-soft text-bad";
  if (s >= 5) return "bg-warn-soft text-warn";
  return "bg-good-soft text-good";
}

export default function HeatMap({ risks, caption }: { risks: HeatRisk[]; caption: string }) {
  return (
    <figure>
      <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-20 sm:w-28" />
          <col /><col /><col /><col /><col />
        </colgroup>
        <tbody>
          {[5, 4, 3, 2, 1].map((l) => (
            <tr key={l}>
              <th scope="row" className="pr-2 text-right text-xs font-normal leading-tight text-ink-2">
                {l} {LIKELIHOOD[l - 1]}
              </th>
              {[1, 2, 3, 4, 5].map((i) => {
                const here = risks.filter((r) => r.l === l && r.i === i);
                return (
                  <td key={i} className={`h-16 rounded align-top p-1.5 ${cellClass(l * i)}`}>
                    {here.length > 0 && (
                      <>
                        <span className="text-lg font-semibold leading-none">{here.length}</span>
                        <span className="mt-1 flex flex-wrap gap-x-1.5 text-[11px] leading-tight">
                          {here.slice(0, 4).map((r) => (
                            <Link key={r.id} href={`/records/${r.id}`} title={r.title} className="underline decoration-dotted hover:decoration-solid">
                              {r.ref.replace("RSK-", "")}
                            </Link>
                          ))}
                          {here.length > 4 && <span>+{here.length - 4}</span>}
                        </span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td />
            {IMPACT.map((x, idx) => (
              <th key={x} scope="col" className="pt-1 text-center text-xs font-normal leading-tight text-ink-2">
                {idx + 1} {x}
              </th>
            ))}
          </tr>
        </tbody>
      </table>
      <figcaption className="mt-1 text-xs text-ink-3">Likelihood up, impact across. Numbers in cells are risk references.</figcaption>
    </figure>
  );
}
