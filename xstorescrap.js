const puppeteer = require("puppeteer")
const fs = require("fs").promises
const { v4: uuidv4 } = require("uuid")

class XboxPriceScraper {
  constructor(platform) {
    this.platform = platform
    this.visibleSelector =
      ".ProductCard-module__cardWrapper___6Ls86"
    this.list = []
  }

  async init(url) {
    try {
      this.browser = await puppeteer.launch({ headless: false })
      this.page = await this.browser.newPage()
      await this.page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000, 
      })

      let loadMoreButton
      let hasClickedMore = false
      while (
        (loadMoreButton = await this.page.$(
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
      

      
        await this.page.waitForFunction(
          () =>
            !document.querySelector(
              "button.commonStyles-module__basicButton___go-bX"
            )
        )
      
        await this.page.waitForTimeout(3000)
      }

      await this.page.waitForSelector(this.visibleSelector, {
        visible: true,
        timeout: 60000, 
      })
      console.log("Scraping data from", url)
    } catch (error) {
      console.error("Error initializing page:", error)
      await this.cleanup()
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
            const alternativeTitleElement = e.querySelector(
              ".ProductCard-module__singleLineTitle___32jUF"
            )

            const title = titleElement
              ? titleElement.innerText.toUpperCase()
              : alternativeTitleElement
              ? alternativeTitleElement.innerText.toUpperCase()
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
      console.error("Error during page evaluation:", error)
      return []
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close()
    }
  }
}

const run = async () => {
  const browser = await puppeteer.launch()

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
    const scraper = new XboxPriceScraper(platform)
    await scraper.init(url)
    let results = await scraper.scrapePage()

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
    await scraper.cleanup()
  }

  const jsonData = JSON.stringify(allResults, null, 2)
  const folderName = "xbox-data"
  const randomId = uuidv4().slice(0, 4)
  const jsonFileName = `${folderName}/${randomId}_xbox_games.json`

  try {
    await fs.mkdir(folderName, { recursive: true })
  } catch (error) {
    console.error("Error creating folder:", error)
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
  await browser.close()
}

run()
