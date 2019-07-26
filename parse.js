const fs = require("fs");
const request = require("request");
const colors = require("colors");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

// max no. of items to lookup (each page has 20 results, use multiples of 20)
let max = 5000;
let urlList = [];
let cooldown = 10000;
// get the last known request index
let lastChecked = Number(fs.readFileSync("./lastRequest.json")) || 0;

// insert pages to request into array until max
for (var i = lastChecked; i < max; i += 20) {
  let url = `https://www.kvraudio.com/plugins/windows/macosx/instruments/effects/hosts/free/newest/start${i}`;
  urlList.push(url);
}

urlList.forEach((url, i) => {
  let hasBeenRedirected = false;
  makeRequest(url, i, hasBeenRedirected);
});

function getURLs(dom) {
  // get node list containing all product boxes on each page
  let productBoxes = dom.window.document.querySelectorAll(".kvrpboxa");
  let urls = [];

  productBoxes.forEach(product => {
    let url = `https://www.kvraudio.com${product.href}`;
    urls.push(url);
  });
  console.log(urls);
  getTags(urls);
}

function getTags(urls) {
  let vsts = {};
  // make second round of requests, get tags, build up object, call saveResults()
  urls.forEach((url, i) => {
    setTimeout(() => {
      console.log(`currently scraping ${url}`.bold.blue);
      request(url, (error, response, body) => {
        if (error) {
          console.log(`received ${error} on ${url}`.red);
        } else {
          try {
            let dom = new JSDOM(body);
            let detailsBox = dom.window.document.querySelector(".pdetails")
              .children;
            let name = detailsBox[0].children[0].cells[1].textContent;
            let developer = detailsBox[0].children[1].cells[1].textContent;
            let tagsBox = dom.window.document.querySelector(".pdetails")
              .children[0].children[3].cells[1].children;
            let tags = [];

            for (let i = 0; i < tagsBox.length; i++) {
              tags.push(tagsBox[i].textContent);
            }

            let bodySection = dom.window.document.querySelector(".prodbodycon");
            let description = "";

            for (let i = 0; i < bodySection.children.length; i++) {
              description += `${bodySection.children[i].textContent}\n`;
            }

            let downloadsBox = dom.window.document.querySelectorAll(
              ".pdetails"
            )[2];
            let downloadsBoxLinks = downloadsBox.querySelectorAll("a");
            let downloadLinks = [];
            let platforms = [];

            for (let i = 0; i < downloadsBoxLinks.length; i++) {
              // links w/ even indexes are OS icons which we derive OS compatibility from
              if (i % 2 === 0) {
                platforms.push(downloadsBoxLinks[i].title);
              }
              // links w/ odd indexes are download links
              else {
                downloadLinks.push(downloadsBoxLinks[i].href);
              }
            }

            let formatsBox = dom.window.document.querySelectorAll(
              ".pdetails"
            )[1];
            let formatsArray =
              formatsBox.children[0].children[0].cells[1].children;
            let formats = [];

            // check for formats and append as necessary
            for (let i = 0; i < formatsArray.length; i++) {
              switch (formatsArray[i].title.toLowerCase()) {
                case "vst":
                  formats.push("VST");
                  break;
                case "vst3":
                  formats.push("VST3");
                  break;
                case "au":
                  formats.push("AU");
                  break;
                case "aax":
                  formats.push("AAX");
                  break;
                case "rack extension":
                  formats.push("Rack Extension");
                  break;
              }
            }

            vsts[name] = {
              name,
              developer,
              formats,
              platforms,
              tags,
              description,
              downloadLinks
            };
            console.log(JSON.stringify(vsts[name], null, 2).gray);
            saveResults(vsts, name);
          } catch (e) {
            console.log(e);
          }
        }
      });
    }, cooldown * i);
  });
}

function saveResults(vsts, name) {
  let path = "./vsts.json";
  // check if file exists
  fs.stat(path, (err, stats) => {
    // if not, write file
    if (err || stats === undefined) {
      fs.writeFile(path, JSON.stringify(vsts, null, 2), err => {
        if (err) throw err;
        else
          console.log(
            "created new json file and saved results to disk.".italic.green
          );
        saveLastRequest(lastChecked);
      });
    } else {
      // read-in existing json
      fs.readFile("./vsts.json", (err, data) => {
        if (!err) {
          // parse json into object so we can add stuff to it
          var json = JSON.parse(data);
          // create new entry in json for current vst
          json[vsts[name].name] = vsts[name];
          // overwrite file w/ new changes
          fs.writeFile(path, JSON.stringify(json, null, 2), err => {
            if (!err) {
              console.log("appended results to disk.".italic.green);
              saveLastRequest(lastChecked);
            }
          });
        }
      });
    }
  });
}

function saveLastRequest(lastRequest) {
  lastChecked++;
  fs.writeFile("./lastRequest.json", lastRequest, err => {
    if (err) {
      console.log("error writing last request".red);
    } else {
      console.log("updated last request");
    }
  });
}

// function regenerateCooldown() {
//   // regenerate random cooldown between 1 and 60 seconds
//   return Math.floor(Math.random() * 59000) + 1000;
// }

function makeRequest(url, i, hasBeenRedirected) {
  // cooldown to prevent spamminess
  setTimeout(() => {
    request(
      {
        uri: url,
        // check for redirects (invalid URLs)
        followRedirect: response => {
          console.log(
            `Provided URL ${url} was redirected to: ${
              response.headers.location
            }. Cancelling this batch.`.red
          );
          hasBeenRedirected = true;
          return true;
        }
      },
      (error, response, body) => {
        if (error) {
          // print error in red if request fails outright
          console.log(`received ${error} on ${url}`.red);
        } else if (!hasBeenRedirected) {
          let status = response.statusCode;
          // print green if OK, yellow if any sort of error
          if (status >= 200 && status < 300) {
            console.log(`received status code ${status} on ${url}`.green);
          } else {
            console.log(`received status code ${status} on ${url}`.yellow);
          }

          // convert raw body text to dom
          let dom = new JSDOM(body);
          // pass dom to getURLs() to parse
          getURLs(dom);
        }
      }
    );
    // magic # 21 is "20 URLs per page + 1 as a buffer" - this is JANK AF ASYNC @TODO MAKE LESS JANK
  }, cooldown * 21 * i);
}
