"""
Oasis App — Smoke Test Suite
Verifies all pages render correctly at mobile and desktop viewports.
Run: cd oasis-app && python tests/smoke.py
Requires: pip install playwright && playwright install chromium
"""

import os
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3001"
SCREENSHOT_DIR = "/tmp/oasis-screenshots"
VIEWPORTS = {
    "mobile": {"width": 390, "height": 844},
    "desktop": {"width": 1440, "height": 900},
}


def setup():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    print(f"Screenshots will be saved to {SCREENSHOT_DIR}/")


def screenshot(page, name, viewport_name):
    path = os.path.join(SCREENSHOT_DIR, f"{name}-{viewport_name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"  Saved: {path}")


def test_home(page, vp_name):
    print(f"\n[{vp_name}] Testing Home Page...")
    page.goto(BASE_URL, wait_until="networkidle")
    page.wait_for_timeout(1000)

    # Verify hero text
    assert page.locator("text=Know what").first.is_visible(), "Hero heading not visible"
    print("  Hero section loaded")

    # Verify trending section
    assert page.locator("text=Trending").first.is_visible(), "Trending section not visible"
    print("  Trending section loaded")

    # Verify categories
    assert page.locator("text=Categories").first.is_visible(), "Categories not visible"
    print("  Categories loaded")

    screenshot(page, "01-home", vp_name)
    print(f"  Home page OK")


def test_search(page, vp_name):
    print(f"\n[{vp_name}] Testing Search Page...")
    page.goto(f"{BASE_URL}/search", wait_until="networkidle")
    page.wait_for_timeout(500)

    # Verify search input exists
    search_input = page.locator("input[type='search'], input[placeholder*='Search']").first
    assert search_input.is_visible(), "Search input not visible"
    print("  Search input visible")

    # Verify category chips
    assert page.locator("text=Food").first.is_visible(), "Category chips not visible"
    print("  Category chips visible")

    screenshot(page, "02-search-empty", vp_name)

    # Type a search query
    search_input.fill("maggi")
    page.wait_for_timeout(500)  # wait for debounce

    # Verify result appears
    maggi_result = page.locator("text=Maggi").first
    assert maggi_result.is_visible(), "Maggi search result not visible"
    print("  Search results for 'maggi' appeared")

    screenshot(page, "03-search-results", vp_name)
    print(f"  Search page OK")


def test_product_detail(page, vp_name):
    print(f"\n[{vp_name}] Testing Product Detail Page...")

    # Navigate to search, search for maggi, click result
    page.goto(f"{BASE_URL}/search", wait_until="networkidle")
    page.wait_for_timeout(500)

    search_input = page.locator("input[type='search'], input[placeholder*='Search']").first
    search_input.fill("maggi")
    page.wait_for_timeout(500)

    # Click on the first product result link
    product_link = page.locator("a[href*='/product/']").first
    if product_link.is_visible():
        product_link.click()
    else:
        # Fallback: navigate directly
        page.goto(f"{BASE_URL}/product/maggi-noodles", wait_until="networkidle")

    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Verify score ring is present
    score_element = page.locator("[role='img'][aria-label*='Safety score']").first
    assert score_element.is_visible(), "Score ring not visible"
    print("  Score ring visible")

    # Verify product name
    assert page.locator("text=Maggi").first.is_visible(), "Product name not visible"
    print("  Product name visible")

    # Verify ingredient analysis section
    assert page.locator("text=Ingredient Analysis").first.is_visible(), "Ingredient analysis not visible"
    print("  Ingredient analysis visible")

    screenshot(page, "04-product-detail", vp_name)
    print(f"  Product detail page OK")


def test_profile(page, vp_name):
    print(f"\n[{vp_name}] Testing Profile Page...")
    page.goto(f"{BASE_URL}/profile", wait_until="networkidle")
    page.wait_for_timeout(500)

    # Verify health profile section
    assert page.locator("text=Health").first.is_visible(), "Health section not visible"
    print("  Health profile section visible")

    # Verify scan history
    assert page.locator("text=Scan History").first.is_visible(), "Scan history not visible"
    print("  Scan history visible")

    screenshot(page, "05-profile", vp_name)
    print(f"  Profile page OK")


def test_scan_page(page, vp_name):
    print(f"\n[{vp_name}] Testing Scan Page...")
    page.goto(f"{BASE_URL}/scan", wait_until="networkidle")
    page.wait_for_timeout(1000)

    # Scan page should render (camera may not work in headless but page should load)
    # Check for back button
    back_link = page.locator("a[aria-label*='back'], a[href='/']").first
    assert back_link.is_visible(), "Back button not visible on scan page"
    print("  Back button visible")

    screenshot(page, "06-scan", vp_name)
    print(f"  Scan page OK")


def run_tests():
    setup()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for vp_name, vp_size in VIEWPORTS.items():
            print(f"\n{'='*50}")
            print(f"VIEWPORT: {vp_name} ({vp_size['width']}x{vp_size['height']})")
            print(f"{'='*50}")

            context = browser.new_context(viewport=vp_size)
            page = context.new_page()

            try:
                test_home(page, vp_name)
                test_search(page, vp_name)
                test_product_detail(page, vp_name)
                test_profile(page, vp_name)
                test_scan_page(page, vp_name)
            except Exception as e:
                print(f"\n  FAILED: {e}")
                screenshot(page, "error", vp_name)
                raise
            finally:
                context.close()

        browser.close()

    print(f"\n{'='*50}")
    print("ALL SMOKE TESTS PASSED")
    print(f"Screenshots saved to {SCREENSHOT_DIR}/")
    print(f"{'='*50}")


if __name__ == "__main__":
    run_tests()
