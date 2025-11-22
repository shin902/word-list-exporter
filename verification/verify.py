
from playwright.sync_api import Page, expect, sync_playwright

def verify_static_assets(page: Page):
    """
    Verifies that the main page loads correctly from the new public directory.
    """
    # 1. Navigate to the home page
    page.goto("http://localhost:3000")

    # 2. Check for key elements to ensure the page loaded
    expect(page).to_have_title("My 暗記帳")
    expect(page.get_by_role("heading", name="My 暗記帳")).to_be_visible()

    # 3. Take a screenshot
    page.screenshot(path="verification/homepage.png")

def verify_path_traversal_prevention(page: Page):
    """
    Verifies that sensitive files are not accessible.
    """
    # 1. Try to access .env
    response = page.goto("http://localhost:3000/.env")
    assert response.status == 404

    # 2. Try to access package.json
    response = page.goto("http://localhost:3000/package.json")
    assert response.status == 404

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_static_assets(page)
            verify_path_traversal_prevention(page)
            print("Verification successful!")
        except Exception as e:
            print(f"Verification failed: {e}")
        finally:
            browser.close()
