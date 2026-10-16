import type { Config, Context } from "@netlify/functions"

const PNCP = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"

const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "")

export const fetchEditais = async (opts: { dias: number; uf: string; palavras: string[]; fetchImpl?: typeof fetch }) => {
  const f = opts.fetchImpl ?? fetch
  const fim = new Date()
  const ini = new Date(Date.now() - opts.dias * 86400000)
  const resultados: any[] = []
  for (let pagina = 1; pagina <= 3; pagina++) {
    const url = `${PNCP}?dataInicial=${fmt(ini)}&dataFinal=${fmt(fim)}&codigoModalidadeContratacao=6&uf=${opts.uf}&pagina=${pagina}&tamanhoPagina=50`
    const res = await f(url, { headers: { Accept: "application/json" } })
    if (!res.ok) throw new Error(`PNCP respondeu ${res.status}`)
    const json: any = await res.json()
    const itens: any[] = json.data ?? []
    resultados.push(...itens)
    if (itens.length < 50) break
  }
  const termos = opts.palavras.map((p) => p.trim().toLowerCase()).filter(Boolean)
  return resultados
    .filter((e) => {
      if (!termos.length) return true
      const texto = `${e.objetoCompra ?? ""} ${e.informacaoComplementar ?? ""}`.toLowerCase()
      return termos.some((t) => texto.includes(t))
    })
    .map((e) => ({
      id: e.numeroControlePNCP,
      orgao: e.orgaoEntidade?.razaoSocial,
      uf: e.unidadeOrgao?.ufSigla,
      objeto: e.objetoCompra,
      valor: e.valorTotalEstimado,
      abertura: e.dataAberturaProposta,
      link: e.linkSistemaOrigem,
    }))
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const dias = Math.min(Number(url.searchParams.get("dias") ?? 7), 30)
  const uf = (url.searchParams.get("uf") ?? "CE").toUpperCase()
  const palavras = (url.searchParams.get("q") ?? "").split(",")
  try {
    const editais = await fetchEditais({ dias, uf, palavras })
    return Response.json({ total: editais.length, editais })
  } catch (err) {
    return Response.json({ erro: String(err) }, { status: 502 })
  }
}

export const config: Config = { path: "/api/editais" }
