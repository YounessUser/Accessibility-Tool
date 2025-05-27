import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import sqlite3 from 'sqlite3';
import axios from 'axios';

const app = express()
const port = 3000
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

// Middleware to parse JSON and form data
app.use(express.json()); // Parse JSON data
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data

app.set('view engine', 'html');

const db = new sqlite3.Database('accessibility.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the database.');
});

db.run(`CREATE TABLE IF NOT EXISTS accessibilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    lhDesktopScore TEXT,
    lhMobileScore TEXT,
    lhDesktopViolations TEXT,
    lhMobileViolations TEXT,
    waveDesktopResults TEXT,
    waveMobileResults TEXT
)`, (err) => {
  if (err) {
    console.error(err.message);
  }
});


app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname });
})


app.get('/all', (req, res) => {
  db.all('SELECT * FROM accessibilities', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

function getViolations(violations) {
  console.log(violations);
  let violationsArray = {};
  if (violations) {
    let index = 0;
    for (const violation of violations) {
      if (violation.nodes && violation.nodes.length > 0) {
        for (const node of violation.nodes) {
          if (node.target && node.failureSummary) {
            violationsArray[index++] = {
              target: node.target,
              failureSummary: node.failureSummary
            };
          }
        }
      }

    }
  }
  return violationsArray;
}


function getAccessibilityByUrl(url) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM accessibilities WHERE url = ?', [url], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}
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

  let runnerResult = { desktop: {}, mobile: {} };

  for (let i = 0; i < urls.length; i++) {
    let url = urls[i].trim();


    for (const optionSet of lighthouseOptionsArray) {
      let device = optionSet.settings.emulatedFormFactor;
      let result = await lighthouse(url, options, optionSet);
      console.log(result)
      runnerResult[device][url] = { score: 0, violations: {} };
      runnerResult[device][url]['score'] = result.lhr.categories.accessibility.score * 100;
      runnerResult[device][url]['violations'] = (result.artifacts && result.artifacts.Accessibility && result.artifacts.Accessibility.violations) ?
                                                        JSON.stringify(getViolations(result.artifacts.Accessibility.violations)) :
                                                        '{}';

    }
    const existingAccessibility = await getAccessibilityByUrl(url);
    console.log("Existing Accessibility Record: ", existingAccessibility);
    if (existingAccessibility) {
      console.log("Updating existing record for URL:", url);
      db.run(
        'UPDATE accessibilities SET lhDesktopScore = ?, lhMobileScore = ?, lhDesktopViolations = ?, lhMobileViolations = ? WHERE url = ?',
        [runnerResult["desktop"][url]['score'], runnerResult["mobile"][url]['score'], runnerResult["desktop"][url]['violations'], runnerResult["mobile"][url]['violations'], url],
        function (err) {
          if (err) {
            console.error("Database Error: ", err);
          }
        });
    } else {
      db.run(
        'INSERT INTO accessibilities (url, lhDesktopScore, lhMobileScore, lhDesktopViolations, lhMobileViolations) VALUES (?, ?, ?, ?, ?)',
        [url, runnerResult["desktop"][url]['score'], runnerResult["mobile"][url]['score'], runnerResult["desktop"][url]['violations'], runnerResult["mobile"][url]['violations']],
        function (err) {
          console.log("database Error ", err);
        });
    }
  }
  res.json(runnerResult);
  chrome.kill();
});

app.post('/wave', async (req, res) => {
  const urls = req.body.urls;
  let runnerResult = { desktop: {}, mobile: {} };
  const apiKey = 'eG4rseK15412';


  for (let i = 0; i < urls.length; i++) {
    let url = urls[i].trim();
    runnerResult['desktop'][url] = {};
    runnerResult['mobile'][url] = {};
    try {
      let apiDesktopUrl = `https://wave.webaim.org/api/request?key=${apiKey}&reporttype=4&url=${encodeURIComponent(url)}&viewportwidth=1440`;
      let apiMobileUrl = `https://wave.webaim.org/api/request?key=${apiKey}&reporttype=4&url=${encodeURIComponent(url)}&viewportwidth=375`;


      const mobileResult = await axios.get(apiMobileUrl);
      const desktopResult = await axios.get(apiDesktopUrl);

      console.log("Wave API Response: ", desktopResult.data, mobileResult.data);
      runnerResult['desktop'][url]['results'] = JSON.stringify(desktopResult.data);
      runnerResult['mobile'][url]['results'] = JSON.stringify(mobileResult.data);

      const existingAccessibility = await getAccessibilityByUrl(url);
      if (existingAccessibility) {
        db.run(
          'UPDATE accessibilities SET waveDesktopResults = ?, waveMobileResults = ? WHERE url = ?',
          [JSON.stringify(desktopResult.data), JSON.stringify(mobileResult.data), url],
          function (err) {
            if (err) {
              console.error("Database Error: ", err);
            }
          });
      } else {
        db.run(
          'INSERT INTO accessibilities (url, waveDesktopResults, waveMobileResults) VALUES (?, ?, ?)',
          [url, JSON.stringify(desktopResult.data), JSON.stringify(mobileResult.data)],
          function (err) {
            if (err) {
              console.error("Database Error: ", err);
            }
          });
      }

    } catch (error) {
      console.error("Error fetching Wave API data: ", error);
      return res.status(500).json({ error: 'Failed to fetch Wave API data' });
    }

  }

  res.json(runnerResult);
});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});


process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Close the database connection.');
    process.exit(0);
  });
});