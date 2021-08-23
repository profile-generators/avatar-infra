const fs = require('fs');
const parser = require('fast-xml-parser');
const sharp = require('sharp');
const AWS = require('aws-sdk');

const S3 = new AWS.S3();

const bucket = 'hello';

const options = {
  attributeNamePrefix: "",
  attrNodeName: "attr",
  textNodeName: "#text",
  ignoreAttributes: false,
  ignoreNameSpace: false,
  allowBooleanAttributes: true,
  parseNodeValue: true,
  parseAttributeValue: true,
  trimValues: true,
  arrayMode: false
};

const xmlParser = parser;
const jsonParser = new parser.j2xParser(options);

const svgTemplate = {
  "svg": {
    "attr": {
      "height": "124.19042mm",
      "id": "svg151",
      "version": 1.1,
      "viewBox": "0 0 124.19042 124.19042",
      "width": "124.19042mm",
      "xmlns": "http://www.w3.org/2000/svg",
      "xmlns:cc": "http://creativecommons.org/ns#",
      "xmlns:dc": "http://purl.org/dc/elements/1.1/",
      "xmlns:inkscape": "http://www.inkscape.org/namespaces/inkscape",
      "xmlns:rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    },
    "style": {},
    "g": [],
    "metadata": {
      "rdf:RDF": {
        "cc:Work": {
          "dc:contributor": {
            "cc:Agent": {
              "dc:title": ""
            }
          },
          "dc:source": "https://github.com/profile-generators/avatar-parts",
        },
        "cc:License": {
          "attr": {
            "rdf:about": "http://creativecommons.org/licenses/by/4.0/"
          },
          "cc:permits": [
            {
              "attr": {
                "rdf:resource": "http://creativecommons.org/ns#Reproduction"
              }
            },
            {
              "attr": {
                "rdf:resource": "http://creativecommons.org/ns#Distribution"
              }
            },
            {
              "attr": {
                "rdf:resource": "http://creativecommons.org/ns#DerivativeWorks"
              }
            }
          ],
          "cc:requires": [
            {
              "attr": {
                "rdf:resource": "http://creativecommons.org/ns#Notice"
              }
            },
            {
              "attr": {
                "rdf:resource": "http://creativecommons.org/ns#Attribution"
              }
            }
          ]
        }
      }
    }
  }
};

function cloneDeep(obj) {
  if (Array.isArray(obj)) {
    const res = [];
    for (let i=0; i < obj.length; i++) {
      res[i] = cloneDeep(obj[i]);
    }
    return res;
  } else if (typeof obj == 'object') {
    const res = {};
    for (let key in obj) {
      res[key] = cloneDeep(obj[key]);
    }
    return res;
  }
  return obj;
}

function parsePart(data) {
  const xml = parser.parse(data, options);
  const layer = xml.svg.g;
  const creator = xml.svg.metadata['rdf:RDF']['cc:Work']['dc:creator']['cc:Agent']['dc:title'];

  return { layer, creator };
}

function buildSVG(parts, palette) {
  const doc = cloneDeep(svgTemplate);

  doc.svg.style = Object.entries(palette).map(([name, color]) => `.${name} { fill: ${color}; }`).join(' ');

  const layers = [];
  const contributors = new Set();
  for (let { layer, creator } of parts) {
    layers.push(layer);
    contributors.add(creator);
  }

  doc.svg.g = layers;
  doc.svg.metadata['rdf:RDF']['cc:Work']['dc:contributor']['cc:Agent']['dc:title'] = [...contributors].join(', ');

  console.log(doc);

  return jsonParser.parse(doc);
}

async function renderSVG(svg) {
  console.log(svg)

  return sharp(Buffer.from(svg))
    .resize(256, 256)
    .png({ compressionLevel: 9 })
    .toFile('output.png');
  //  .toBuffer();
}

async function getPart(key) {
  const params = {
    Bucket: bucket,
    Key: key
  };

  const data = await S3.getObject(params).promise();

  return data;
}

async function keyExists(key) {
  const params = {
    Bucket: bucket,
    Key: key
  };

  const data = await S3.headObject(params).promise();

  return data.err == null;
}

async function uploadPNG(key, buffer) {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
    CacheControl: 'public, max-age=604800, immutable'
  }

  const data = await S3.putObject(params).promise();
}

const letters = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randomName(size) {
  let name = "";
  for (let i=0; i < size; i++) {
    name += letters[Math.floor(Math.random() * letters.length)];
  }
  return name;
}

function run() {
  const part = fs.readFileSync('parts/hair/hair_0000.svg', { encoding: 'utf-8' });

  const palette = {
    'flesh': '#ff0000',
    'hair': '#00ff00'
  };

  const parts = [ parsePart(part) ];
  const svg = buildSVG(parts, palette);

  renderSVG(svg);

  console.log(randomName(8));
}

'use strict';
exports.handler = async (event, context) => {

  //Get contents of response
  //const response = event.Records[0].cf.response;
  //const headers = response.headers;

  const request = event.Records[0].cf.request;

  const url = request.uri;
  const body = request.body.data;

  console.log(url);
  console.log(body);

  const response = {
    status: '200',
    statusDescription: 'OK',
    headers: {
      
    },
    body: ''
  };

  //Return modified response
  return response;
};

run();
