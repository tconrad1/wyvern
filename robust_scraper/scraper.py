import asyncio
from crawl4ai import *

async def main():
    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(
            url="https://5e.tools/book.html#xdmg",
        )
        print(result.markdown)

if __name__ == "__main__":
    asyncio.run(main())