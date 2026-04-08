from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    # Handle dialogs (alerts)
    page.on("dialog", lambda dialog: (print(f"Dialog: {dialog.message}"), dialog.accept()))

    # Use absolute path for file:// URL
    abs_path = os.path.abspath("verification/combined_index.html")
    page.goto(f"file://{abs_path}")
    page.wait_for_timeout(1000)

    # Step 1: Fiscal Data
    # Using a more likely valid-looking RFC for the regex
    page.fill("#rfc", "GOCL800101TS0")
    page.wait_for_timeout(500)
    page.fill("#razonSocial", "Empresa de Prueba S.A. de C.V.")
    page.wait_for_timeout(500)
    page.fill("#representante", "Juan Perez")
    page.wait_for_timeout(500)
    page.fill("#telefono", "5512345678")
    page.wait_for_timeout(500)
    page.fill("#email", "prueba@empresa.com")
    page.wait_for_timeout(500)

    page.click("button:has-text('Siguiente')")
    page.wait_for_timeout(1000)

    # Step 2: Branches
    # Ensure step 2 is visible
    page.wait_for_selector("#branchName", state="visible")

    page.fill("#branchName", "Sucursal Centro")
    page.wait_for_timeout(500)
    page.fill("#branchAddress", "Av. Principal 123, Col. Centro, CP 06000")
    page.wait_for_timeout(500)
    page.fill("#branchManager", "Maria Garcia")
    page.wait_for_timeout(500)

    page.click("button:has-text('Agregar Sucursal')")
    page.wait_for_timeout(1000)

    # Click next on step 2
    page.click("#step-2 button:has-text('Siguiente')")
    page.wait_for_timeout(1000)

    # Step 3: Branch Commitments
    page.wait_for_selector("#c1-0", state="visible")
    page.click("#c1-0")
    page.wait_for_timeout(300)
    page.click("#c2-0")
    page.wait_for_timeout(300)
    page.click("#c3-0")
    page.wait_for_timeout(300)
    page.click("#c4-0")
    page.wait_for_timeout(300)
    page.click("#c5-0")
    page.wait_for_timeout(300)

    page.click("#step-3 button:has-text('Siguiente')")
    page.wait_for_timeout(1000)

    # Step 4: General Commitments
    page.wait_for_selector("#gc1", state="visible")
    page.click("#gc1")
    page.wait_for_timeout(300)
    page.click("#gc2")
    page.wait_for_timeout(300)
    page.click("#gc3")
    page.wait_for_timeout(300)
    page.click("#gc4")
    page.wait_for_timeout(300)
    page.click("#gc5")
    page.wait_for_timeout(300)
    page.click("#terms")
    page.wait_for_timeout(300)
    page.click("#privacy")
    page.wait_for_timeout(300)

    page.click("#step-4 button:has-text('Siguiente')")
    page.wait_for_timeout(1000)

    # Step 5: Review
    page.wait_for_selector("#step-5", state="visible")
    page.screenshot(path="verification/screenshots/review_step.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
