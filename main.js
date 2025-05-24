import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';


// import fs from 'fs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { log } from 'console';

const app = express()
const port = 3000
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

// Middleware to parse JSON and form data
app.use(express.json()); // Parse JSON data
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data

app.set('view engine', 'html');

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname });
})

app.post('/lighthouse', async (req, res) => {
  const chrome = await chromeLauncher.launch({ chromeFlags: ["--no-sandbox", "--headless"] });
  const options = { logLevel: 'info', enableErrorReporting: true, output: 'json', onlyCategories: ['accessibility'], port: chrome.port };
  const lighthouseOptionsArray = [
    {
      extends: 'lighthouse:default',
      settings: {
        onlyCategories: ['accessibility'],
        emulatedFormFactor: 'desktop',
        output: ['json'],
      },
    },
    {
      extends: 'lighthouse:default',
      settings: {
        onlyCategories: ['accessibility'],
        emulatedFormFactor: 'mobile',
        output: ['json'],
      },
    },
  ];
  const urls = req.body.urls;

  let runnerResult = {desktop: {}, mobile: {}};
    for (const optionSet of lighthouseOptionsArray) {
      let device = optionSet.settings.emulatedFormFactor;
      
      for (let i = 0; i < urls.length; i++) {
        let url = urls[i].trim();
        let result = await lighthouse(url, options, optionSet);
        console.log(result.lhr);
        
        runnerResult[device][url] = result.lhr.categories.accessibility.score * 100;
      }
    }
  console.log(runnerResult);
  res.json(runnerResult);
  chrome.kill();
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
