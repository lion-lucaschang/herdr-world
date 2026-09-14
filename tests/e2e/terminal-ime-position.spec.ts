import { expect, test, type Locator, type Page } from "@playwright/test";

// Exercise the real Ghostty renderer against the synthetic HTTP/WebSocket fixture.
// CDP generates browser composition events; no live agent receives test input.
for (const deviceScaleFactor of [1, 2]) {
  test.describe(`Office IME at DPR ${deviceScaleFactor}`, () => {
    test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor });
    test.setTimeout(90_000);

    test("preedit and candidate anchor follow the cursor through move and resize", async ({ page, request }, testInfo) => {
      await request.post("/__fixture/reset");
      await page.goto("/");
      await page.locator(".agent-row").filter({ hasText: "Codex A" }).click();
      const bubble = page.locator(".world-conversation-bubble").first();
      const textarea = bubble.locator("textarea.ghostty-hidden-input");
      await expect(textarea).toHaveCount(1);
      await expect(bubble.locator(".terminal-overlay")).toHaveCount(0);
      const cdp = await page.context().newCDPSession(page);
      const readInput = async () => {
        const log = await (await request.get("/__fixture/requests")).json();
        return log["host-a"].terminalInput.filter((frame: { type: string }) => frame.type === "input");
      };

      for (const phase of ["opened", "moved", "resized"] as const) {
        if (phase === "moved") {
          await drag(page, bubble.locator(".world-conversation-header"), 55, 45);
        } else if (phase === "resized") {
          const before = await bubble.boundingBox();
          const readResizeCount = async () => {
            const log = await (await request.get("/__fixture/requests")).json();
            return log["host-a"].terminalResize.length;
          };
          const resizeCount = await readResizeCount();
          await drag(page, page.locator(".world-conversation-resize").first(), -90, 40);
          await expect.poll(async () => (await bubble.boundingBox())?.width).toBeLessThan(before!.width);
          // Wait for measured cell dimensions to reach the WebSocket, not just
          // for the pointer drag to finish.
          await expect.poll(readResizeCount).toBeGreaterThan(resizeCount);
        }
        await textarea.focus();
        // The fixture echoes ANSI: put the cursor in row 4, column 6 before composing.
        const inputCount = (await readInput()).length;
        await page.keyboard.insertText("\u001b[4;6H");
        await expect.poll(async () => (await readInput()).length).toBeGreaterThan(inputCount);
        // Receiving input is not equivalent to rendering its echo. Focus refreshes
        // the anchor from Ghostty's current buffer; wait for the CUP to be parsed.
        await expect.poll(async () => {
          await textarea.evaluate((input) => {
            input.blur();
            input.focus({ preventScroll: true });
          });
          const geometry = await cursorGeometry(bubble, textarea);
          return Math.abs(geometry.anchor.x - geometry.cursor.x) +
            Math.abs(geometry.anchor.y - geometry.cursor.y);
        }).toBeLessThan(1);
        const inputBefore = await readInput();
        const boundsBefore = await bubble.boundingBox();
        await cdp.send("Input.imeSetComposition", { text: "中文測試", selectionStart: 4, selectionEnd: 4 });
        const overlay = bubble.locator(".ghostty-ime-preedit");
        await expect(overlay).toBeVisible();
        await expect(overlay).toHaveText("中文測試");
        const geometry = await cursorGeometry(bubble, textarea);
        await testInfo.attach(`${phase}-geometry`, { body: JSON.stringify(geometry, null, 2), contentType: "application/json" });
        await page.screenshot({ path: testInfo.outputPath(`${phase}-composition.png`) });
        for (const point of [geometry.textarea, geometry.preedit]) {
          expect(Math.abs(point.x - geometry.cursor.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(point.y - geometry.cursor.y)).toBeLessThanOrEqual(1);
        }
        expect(await bubble.boundingBox()).toEqual(boundsBefore);
        expect(await readInput()).toEqual(inputBefore);
        // Commit Chinese text without submitting a terminal command.
        await cdp.send("Input.insertText", { text: "中文測試" });
        await expect(overlay).toBeHidden();
        await expect.poll(async () => (await readInput()).slice(inputBefore.length).map((f: { data: string }) => f.data).join(""))
          .toBe("中文測試");
      }
      await cdp.detach();
    });
  });
}

async function drag(page: Page, locator: Locator, dx: number, dy: number) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Missing drag target");
  const x = box.x + Math.min(25, box.width / 2);
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}

async function cursorGeometry(bubble: Locator, textarea: Locator) {
  await expect(bubble.locator(".terminal-host")).toBeVisible();
  return textarea.evaluate((input) => {
    const host = input.closest(".terminal-host")!;
    const overlay = host.querySelector(".ghostty-ime-preedit")!;
    const canvas = host.querySelector("canvas")!;
    const rect = input.getBoundingClientRect();
    const preedit = overlay.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    // Native input size equals the renderer's cell metrics. Derive the expected
    // cell from the known ANSI cursor position, not the preedit's CSS coordinates.
    const cellWidth = parseFloat(input.style.width);
    const cellHeight = parseFloat(input.style.height);
    return {
      cursor: { x: canvasRect.x + 5 * cellWidth, y: canvasRect.y + 3 * cellHeight },
      anchor: { x: parseFloat(input.style.left), y: parseFloat(input.style.top) },
      textarea: { x: rect.x, y: rect.y },
      preedit: { x: preedit.x, y: preedit.y },
    };
  });
}
