from playwright.sync_api import sync_playwright
import os

def verify_preview(page, filename):
    abs_path = os.path.abspath(f"preview/{filename}")
    page.goto(f"file://{abs_path}")
    page.wait_for_timeout(1000)

    # Take a screenshot to show the bypass button and initial state
    page.screenshot(path=f"verification/screenshots/{filename}_start.png")

    if "index" in filename:
        # Try to go to next step without filling anything (bypass should allow it)
        page.click("button:has-text('Siguiente')")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"verification/screenshots/{filename}_step2.png")
    else:
        # Panel preview - should show dashboard immediately due to mock
        page.click("button:has-text('Acceder a mi panel')")
        page.wait_for_timeout(1000)
        page.screenshot(path=f"verification/screenshots/{filename}_dashboard.png")

if __name__ == "__main__":
    if not os.path.exists('verification/screenshots'):
        os.makedirs('verification/screenshots')
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            verify_preview(page, "index_preview.html")
            verify_preview(page, "panel_preview.html")
        finally:
            context.close()
            browser.close()
