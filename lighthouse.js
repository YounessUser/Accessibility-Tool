// import { lighthouse } from 'lighthouse';

// import { Launcher, launch } from 'chrome-launcher';

// import { appendFile } from 'node:fs';


// export const runLighthouse =  async (urls, output) => {
	
// const chrome = await launch({
// 	chromeFlags: [ '--headless', ],
// },);
// 	// use the port in options from chrome launcher 
// const lighthouseOptions = {
// 	logLevel: 'info',
// 	output: 'json',
// 	onlyCategories: ['accessibility'],
// 	port: chrome.port,
// };

//   try {
//     const result = await lighthouse(url, lighthouseOptions );
//     console.log(result.report);
// 	output.innerText += result.report;
	
// 	// appendFile('acc-raport.html', result.report, function (err) {
// 	// 	if (err) throw err;
// 	// 	console.log('Saved!');
// 	// });
//   } catch (error) {
//     console.error("Error running Lighthouse:", error);
//   }
// }


// //runLighthouse('https://ai.google.dev/gemini-api/docs/pricing');