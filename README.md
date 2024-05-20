# Xbox Store (AR) Scrapper

## Description

This script utilizes Puppeteer to scrape game information from the Xbox Games Store Argentina website. It retrieves details such as game title, price, discount percentage, platform, and more. The scraped data is then saved as a JSON file in a specified folder.

## Usage

1. **Install Node.js:** Make sure you have Node.js installed on your system.

2. **Clone the Repository:** Clone this repository to your local machine.

3. **Install Dependencies:** Navigate to the project directory and run:

   ```bash
   npm install
   ```

4. **Run the Script:** Once dependencies are installed, execute the script:

   ```bash
   node xstorescrap.js
   ```

This will initiate the scraping process and generate the JSON file with Xbox store data.

### JSON Example

```js
{
"price": "2699,25",
"gameType": "Offer",
"title": "STRAY",
"url": "https://www.xbox.com/es-AR/games/store/stray/9NMPDQ2NRX34/0010",
"imgUrl": "https://store-images.s-microsoft.com/image/apps.25919.13754210357812593...",
"discountPercentage": "25%",
"oldPrice": "3599,00",
"platform": "PC"
},

```

### Dependencies

- [Puppeteer](https://github.com/puppeteer/puppeteer) for web scraping.
- [fs.promises](https://nodejs.org/api/fs.html#fs_fs_promises_api) for file system operations.
- [uuid](https://github.com/uuidjs/uuid) for generating unique identifiers.

### License

This project is licensed under the MIT License.
