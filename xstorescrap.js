const puppeteer = require("puppeteer")
const fs = require("fs").promises
const { v4: uuidv4 } = require("uuid")

class XboxPriceScraper {
  constructor(htmlFilePath, platform) {
    this.htmlFilePath = htmlFilePath
    this.platform = platform
    this.visibleSelector =
      ".ProductCard-module__cardWrapper___6Ls86"
    this.list = []
  }

  async init() {
    try {
      this.browser = await puppeteer.launch()
      this.page = await this.browser.newPage()
      const htmlContent = await fs.readFile(
        this.htmlFilePath,
        "utf-8"
      )
      await this.page.setContent(htmlContent)
      await this.page.waitForSelector(this.visibleSelector, {
        visible: true,
        timeout: 300000,
      })
      console.log(
        "Digging into the HTML and retrieving all the games."
      )
    } catch (error) {
      console.log(
        "Sorry. There was a problem with loading the page. Please check your internet connection and try again.",
        error
      )
      if (this.browser) {
        await this.browser.close()
      }
    }
  }

  async scrapePage() {
    try {
      return await this.page.evaluate(() => {
        const cleanPrice = (price) => {
          const parsedPrice = parseFloat(
            price
              .replace("ARS$", "")
              .replace(/\./g, "")
              .replace(",", ".")
          )
          return isNaN(parsedPrice) ? 0 : parsedPrice
        }

        return Array.from(
          document.querySelectorAll(
            ".ProductCard-module__cardWrapper___6Ls86"
          ),
          (e) => {
            const availableToBuy = e.querySelector(
              ".ProductCard-module__price___cs1xr"
            )
            const onOffer = !!e.querySelector(
              ".ProductCard-module__discountTag___OjGFy"
            )
            const currentPrice = availableToBuy
              ? cleanPrice(availableToBuy.textContent)
              : 0
            const gameType = onOffer
              ? "Offer"
              : currentPrice === 0
              ? "Free"
              : "All"

            let discount = null

            if (onOffer) {
              const discountElement = e.querySelector(
                ".ProductCard-module__discountTag___OjGFy"
              )
              discount = discountElement
                ? parseFloat(
                    discountElement.innerText
                      .replace("-", "")
                      .replace("%", "")
                      .trim()
                  )
                : null
            }

            let oldPrice = currentPrice

            if (discount) {
              const discountDecimal = discount / 100
              oldPrice = currentPrice / (1 - discountDecimal)
            }

            const imgUrl = e
              .querySelector(
                ".ProductCard-module__boxArt___-2vQY"
              )
              .getAttribute("src")
            const titleElement = e.querySelector(
              ".ProductCard-module__title___nHGIp"
            )
            const title = titleElement
              ? titleElement.innerText.toUpperCase()
              : ""

            const gameInfo = {
              price: currentPrice.toFixed(2).replace(".", ","),
              gameType: gameType,
              title: title,
              url: e
                .querySelector(
                  ".commonStyles-module__basicButton___go-bX"
                )
                .getAttribute("href"),
              imgUrl: imgUrl,
              platform: this.platform,
              discountPercentage: discount
                ? `${discount}%`
                : null,
            }

            if (discount) {
              gameInfo.oldPrice = oldPrice
                .toFixed(2)
                .replace(".", ",")
            }

            return gameInfo
          }
        )
      })
    } catch (error) {
      console.log("Error during page evaluation:", error)
      return []
    }
  }

  async scrape() {
    let results = []
    try {
      results = await this.scrapePage()
      this.list = this.list.concat(results)
    } catch (error) {
      console.log("Error during scraping:", error)
    } finally {
      await this.browser.close()
    }
    return this.list
  }
}

const scrapeXboxPage = async (page, url, platform) => {
  try {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 300000,
    })

    let loadMoreButton
    let hasClickedMore = false
    while (
      (loadMoreButton = await page.$(
        "button.commonStyles-module__basicButton___go-bX"
      ))
    ) {
      if (!hasClickedMore) {
        console.log(
          "Now just wait for 5 to 10 minutes, please. This process may take a little while as necessary tasks are being completed. Thank you for your patience and understanding!"
        )
        hasClickedMore = true
      }
      await loadMoreButton.click()
      await page.waitForTimeout(3000)
    }

    const randomId = uuidv4().slice(0, 8)
    const fileName = `${randomId}_${platform}-xbox_page.html`

    const html = await page.content()
    await fs.writeFile(fileName, html)
    console.log(`HTML temporarily saved as ${fileName}.`)
    return fileName
  } catch (error) {
    console.error("Error:", error)
  }
}

const run = async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  const urls = [
    {
      url: "https://www.xbox.com/es-AR/games/all-games/pc?PlayWith=PC&xr=shellnav",
      platform: "PC",
    },
    {
      url: "https://www.xbox.com/es-AR/games/all-games/pc?xr=shellnav&orderby=Title+Asc&PlayWith=XboxSeriesX%7CS%2CXboxOne",
      platform: "Console",
    },
  ]

  let allResults = []

  for (const { url, platform } of urls) {
    const htmlFilePath = await scrapeXboxPage(
      page,
      url,
      platform
    )

    const scraper = new XboxPriceScraper(htmlFilePath, platform)
    await scraper.init()
    let results = await scraper.scrape()

    results = results.map((result) => ({
      ...result,
      platform,
    }))

    const uniqueGames = new Set()

    results.forEach((result) => {
      const gameKey = `${result.title}-${result.price}-${result.url}-${result.imgUrl}`

      const gameExists = allResults.some((existingGame) => {
        const existingGameKey = `${existingGame.title}-${existingGame.price}-${existingGame.url}-${existingGame.imgUrl}`
        return existingGameKey === gameKey
      })

      if (!uniqueGames.has(gameKey) && !gameExists) {
        allResults.push(result)
        uniqueGames.add(gameKey)
      }
    })
  }

  const jsonData = JSON.stringify(allResults, null, 2)
  const folderName = "xbox-data"
  const randomId = uuidv4().slice(0, 4)
  const jsonFileName = `${folderName}/${randomId}_xbox_games.json`

  try {
    await fs.mkdir(folderName)
  } catch (error) {
    if (error.code !== "EEXIST") {
      console.error("Error creating folder:", error)
    }
  }

  try {
    await fs.writeFile(jsonFileName, jsonData, "utf-8")
    console.log(
      `All results have been saved to "${jsonFileName}" within the folder "${folderName}".`
    )
  } catch (error) {
    console.error("Error writing JSON file:", error)
  }

  console.log(
    "Thank you for using our script to retrieve game data!"
  )
  try {
    const files = await fs.readdir(__dirname)
    for (const file of files) {
      if (file.endsWith(".html")) {
        await fs.unlink(file)
      }
    }
  } catch (error) {
    console.error("Error deleting HTML files:", error)
  }
  await browser.close()
}

run()
