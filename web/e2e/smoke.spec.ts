import { expect, Page, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROTAS = ["hoje", "projecao", "cenarios", "entenda"] as const;
const VIEWPORTS = [
  { w: 375, h: 812 },
  { w: 430, h: 932 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
];
const PASTA = resolve(process.cwd(), "../docs/assets/screens");

function coletarErros(page: Page) {
  const erros: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => erros.push(`requestfailed: ${r.url()}`));
  return erros;
}

async function esperarRota(page: Page, rota: string) {
  await page.goto(`/#/${rota}`);
  await expect(page.getByTestId("data-base")).toBeVisible();
  if (rota === "hoje") await expect(page.getByTestId("grafico-hoje").locator("canvas").first()).toBeVisible();
  if (rota === "projecao") {
    await expect(page.getByTestId("grafico-fan").locator("canvas").first()).toBeVisible();
    await expect(page.getByText(/Recalculado no navegador/)).toBeVisible({ timeout: 60_000 });
  }
  if (rota === "cenarios") await expect(page.getByTestId("grafico-cenario").locator("canvas").first()).toBeVisible();
  if (rota === "entenda") await expect(page.getByTestId("grafico-backtest").locator("canvas").first()).toBeVisible();
  await page.waitForTimeout(400);
}

test.describe("smoke das rotas", () => {
  for (const rota of ROTAS) {
    test(`/${rota} abre sem erros de console`, async ({ page }) => {
      const erros = coletarErros(page);
      await esperarRota(page, rota);
      await expect(page.getByTestId("rodape")).toContainText("Dados 100% sintéticos");
      expect(erros).toEqual([]);
    });
  }

  test("hoje: tabela, projeção destacada e drill-down", async ({ page }) => {
    await esperarRota(page, "hoje");
    const linhas = page.getByTestId("linha-dia");
    await expect(linhas).toHaveCount(100);
    await expect(page.locator("tr.linha-proj")).toHaveCount(10);
    await linhas.nth(15).click();
    await expect(page.getByTestId("drilldown")).toContainText("Recebimentos de clientes");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("gaveta")).toHaveCount(0);
  });

  test("projeção: KPIs de risco e recálculo no worker", async ({ page }) => {
    await esperarRota(page, "projecao");
    await expect(page.getByTestId("kpi-prob")).toContainText("%");
    await expect(page.getByTestId("kpi-car")).toContainText("R$");
  });

  test("cenários: alavanca altera métrica, vai para a URL e restaura a base", async ({ page }) => {
    await esperarRota(page, "cenarios");
    const antes = await page.getByTestId("kpi-c-prob").innerText();
    const ag = page.getByLabel("Atraso dos clientes (geral) (valor)");
    await ag.fill("10");
    await expect(page).toHaveURL(/ag=10/);
    await expect(page.getByText(/Cenário calculado/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("tabela-delta")).toBeVisible();
    // link compartilhável reabre o mesmo estado
    const url = page.url();
    await page.goto("about:blank");
    await page.goto(url);
    await expect(page.getByLabel("Atraso dos clientes (geral) (valor)")).toHaveValue("10");
    await page.getByTestId("restaurar").click();
    await expect(page).not.toHaveURL(/ag=10/);
    await expect(page.getByTestId("kpi-c-prob")).toContainText(antes.split("\n")[0].slice(0, 2));
  });
});

test.describe("layout responsivo e screenshots", () => {
  for (const vp of VIEWPORTS) {
    for (const rota of ROTAS) {
      test(`${rota} em ${vp.w}x${vp.h}`, async ({ page }) => {
        mkdirSync(PASTA, { recursive: true });
        await page.setViewportSize({ width: vp.w, height: vp.h });
        const erros = coletarErros(page);
        await esperarRota(page, rota);
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra, "overflow horizontal da página").toBeLessThanOrEqual(0);
        if (vp.w <= 430) {
          const pequenos = await page.evaluate(() => {
            const sel = "a[href], button, input, select, summary, tr.clicavel";
            return [...document.querySelectorAll<HTMLElement>(sel)]
              .filter((e) => {
                const r = e.getBoundingClientRect();
                const cs = getComputedStyle(e);
                return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !e.closest("[hidden]");
              })
              .map((e) => ({ tag: e.tagName, txt: (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 30), h: e.getBoundingClientRect().height }))
              .filter((x) => x.h < 43.5);
          });
          expect(pequenos, "alvos de toque < 44px").toEqual([]);
        }
        await page.screenshot({ path: resolve(PASTA, `${rota}-${vp.w}x${vp.h}.png`), fullPage: true });
        expect(erros).toEqual([]);
      });
    }
  }
});
