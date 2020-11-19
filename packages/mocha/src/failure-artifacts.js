'use strict';

const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
// const mkdir = promisify(fs.mkdir);
const mkdirp = promisify(require('mkdirp'));
const filenamify = require('filenamify');
const debug = require('./debug');

function buildTitle(test) {
  let parts = [];

  while (test) {
    if (test.title) {
      parts.unshift(test.title);
    }

    test = test.parent;
  }

  let title = parts.join(' ');

  // Tests with / in the name are bad.
  title = filenamify(title);

  return title;
}

async function failureArtifacts(outputDir) {
  // If an error occurs in `before` or `beforeEach`,
  // there's a chance the browser has not been initialized yet.
  if (!this.browser) {
    debug('Tried to write failure artifacts, but there is no browser set.');
    return;
  }

  let title = buildTitle(this.test);

  // once node 10.12.0
  // await mkdir(outputDir, { recursive: true });
  await mkdirp(outputDir);

  async function writeArtifact(fileName, ...args) {
    let filePath = path.join(outputDir, fileName);
    debug(`Writing failure artifact to ${filePath}.`);
    await writeFile(filePath, ...args);
  }

  let screenshot = await this.browser._browser.takeScreenshot();
  await writeArtifact(`${title}.png`, screenshot, 'base64');

  let html = await this.browser._browser.getPageSource();
  await writeArtifact(`${title}.html`, html);

  let logTypes = await this.browser._browser.getLogTypes();
  for (let logType of logTypes) {
    let logs = await this.browser._browser.getLogs(logType);
    let logsText = JSON.stringify(logs, null, 2);
    await writeArtifact(`${title}.${logType}.txt`, logsText);
  }
}

async function flush() {
  let logTypes = await this.browser._browser.getLogTypes();
  for (let logType of logTypes) {
    // https://v5.webdriver.io/docs/api/chromium.html#getlogs
    // "Log buffer is reset after each request."
    // For the failure logs to be useful, it should only include the failing test,
    // not the whole test run up until the failure. So we need to clear the logs
    // between each test.
    await this.browser._browser.getLogs(logType);
  }
}

module.exports = failureArtifacts;
module.exports.flush = flush;
