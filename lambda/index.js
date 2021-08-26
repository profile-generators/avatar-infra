'use strict';
const fs = require('fs');
const parser = require('fast-xml-parser');
const sharp = require('sharp');
const AWS = require('aws-sdk');

const S3 = new AWS.S3();

const bucket = 'avatrinfra-avatrs3bucket-qomgoacqsllu';

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
    .toBuffer();
}

async function getPart(key) {
  const params = {
    Bucket: bucket,
    Key: key
  };

  const data = await S3.getObject(params).promise();
  const dataString = data.Body.toString('utf-8');

  return parsePart(dataString);
}

async function keyExists(key) {
  const params = {
    Bucket: bucket,
    Key: key
  };

  try {
    await S3.headObject(params).promise();
  } catch (e) {
    return false;
  }

  return true;
}

async function uploadPNG(key, buffer) {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
    CacheControl: 'public, max-age=604800, immutable'
  }

  await S3.putObject(params).promise();
}

const letters = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randomName(size) {
  let name = "";
  for (let i=0; i < size; i++) {
    name += letters[Math.floor(Math.random() * letters.length)];
  }
  return name;
}

const partNames = [
  "backhair", "bust", "neck",
  "ears", "head", "eyes", "eyebrows",
  "nose", "mouth", "freckles", "hair",
  "glasses", "hat"
];

const palette = [
  'flesh', 'flesh2', 'flesh3',
  'hair', 'hair2', 'eye',
  'p1', 'p2', 'p3', 'p4'
];

const colorRegex = /^#[0-9a-f]{6}$/;
function checkInput(body) {
  if (body.parts == null || body.palette == null) {
    return false;
  }

  if (!Array.isArray(body.parts)) {
    return false;
  }

  if (body.parts.length != 13) {
    return false;
  }

  if (body.parts.some(x => x !== parseInt(x))) {
    return false
  }

  if (typeof body.palette !== 'object') {
    return false;
  }

  const paletteSet = new Set(palette);
  for (let key in body.palette) {
    if (!paletteSet.has(key)) {
      return false;
    }
    paletteSet.delete(key);

    if (!colorRegex.test(body.palette[key])) {
      return false;
    }
  }

  return true;
}


const errorResponse = {
  status: '400',
  statusDescription: 'Bad Request',
  headers: {},
};

exports.handler = async (event, context) => {
  const request = event.Records[0].cf.request;

  const url = request.uri;
  const body = request.body.data;

  console.log(url);
  console.log(body);

  if (!checkInput(body)) {
    return errorResponse;
  }

  console.log('input ok!');

  const partsPromises  = [];
  for (const [i, partIndex] of body.parts.entries()) {
    const partName = partNames[i];
    const filename = `${partName}_${partIndex.toString().padStart(4, '0')}.svg`;
    partsPromises.push(
      getPart(`parts/${partName}/${filename}`)
    );
  }

  let parts;
  try {
    parts = await Promise.all(partsPromises);
  } catch (e) {
    console.log(e);
    return errorResponse;
  }

  const palette = body.palette;

  const svg = buildSVG(parts, palette);

  const png = await renderSVG(svg);
  
  let key;
  while (true) {
    key = `p/${randomName(8)}`;
    if (!(await keyExists(key))) {
      break;
    }
  }

  await uploadPNG(key, png);

  const response = {
    status: '200',
    statusDescription: 'OK',
    headers: {},
    body: key
  };

  //Return modified response
  return response;
};