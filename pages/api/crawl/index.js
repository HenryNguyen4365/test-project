import dbConnect from "../../../utils/dbConnect";
import puppeteer from "puppeteer";
import Customers from "../../../models/Customers";
import format from "date-fns/format";
import { themeShop } from "../../../constants/themeShop";
import { getDateChart } from "../../../helpers/utils";
dbConnect();

export default async function handler(req, res) {
  const { shop } = req.query;
  const crawlData = async () => {
    const getFilterShop = () => {
      return themeShop.filter((item) => item.name === shop);
    };

    const filterShop = getFilterShop();
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(filterShop[0].url);
    const presentSales = await page.evaluate(() => {
      let titleLinks = document.querySelector(".item-header__sales-count");
      return titleLinks.innerText;
    });
    const review = await page.evaluate(() => {
      let review = document.querySelector(".is-visually-hidden");
      return review.innerText;
    });

    await browser.close();
    const getPreviousData = async () => {
      const today = new Date();
      const yesterday = new Date(today);

      yesterday.setDate(yesterday.getDate() - 1);
      const data = await Customers.find({
        created_at: format(yesterday, "MM/dd/yyyy"),
      });
      return data;
    };

    const previousDate = await getPreviousData();
    const filterData = previousDate.filter(
      (item) => item.name === filterShop[0].name
    );
    if (previousDate.length === 0) {
      await Customers.findOneAndUpdate(
        {
          created_at: format(yesterday, "MM/dd/yyyy"),
          themeId: filterShop[0].themeId,
          name: filterShop[0].name,
        },
        {
          quantity:
            Number(presentSales.replace(/\D/g, "")) - filterShop[0].fixedSales,
          sales:
            Number(presentSales.replace(/\D/g, "")) - filterShop[0].fixedSales,
          review: Number(review.replace(/[^0-9\.]+/g, "")),
        },
        { upsert: true }
      );
    } else {
      await Customers.findOneAndUpdate(
        {
          created_at: format(new Date(), "MM/dd/yyyy"),
          themeId: filterShop[0].themeId,
          name: filterShop[0].name,
        },
        {
          quantity:
            Number(presentSales.replace(/\D/g, "")) - filterShop[0].fixedSales,
          sales:
            Number(presentSales.replace(/\D/g, "")) -
            filterShop[0].fixedSales -
            filterData[0].quantity,
          review: Number(review.replace(/[^0-9\.]+/g, "")),
        },
        { upsert: true }
      );
    }
  };
  await crawlData();

  const getData = async () => {
    let time = getDateChart("this_week");
    await Customers.find({
      created_at: {
        $gte: time.start,
        $lte: time.end,
      },
    })
      .exec()
      .then((data) => {
        const filterData = data.filter(item => item.name === shop)
        res.json(filterData);
      });
  };
  await getData();
}
