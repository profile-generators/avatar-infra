'use strict';
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({ 'region': 'us-east-1' });
const S3 = new AWS.S3();
const bucket = 'avatrinfra-avatrs3bucket-qomgoacqsllu';

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

const letters = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randomName(size) {
  let name = "";
  for (let i=0; i < size; i++) {
    name += letters[Math.floor(Math.random() * letters.length)];
  }
  return name;
}

const palette = [
  'flesh', 'flesh2', 'flesh3',
  'hair', 'hair2', 'eye',
  'p1', 'p2', 'p3', 'p4'
];
const colorRegex = /^#[0-9a-f]{6}$/;
function checkInput(event) {
  if (event.Records[0].cf.request.body == null) {
    return false;
  }

  let body;
  try {
    body = JSON.parse(Buffer.from(event.Records[0].cf.request.body.data, 'base64').toString());
  } catch (e) {
    return false;
  }

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
    return false;
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

  return body;
}

const clientErrorResponse = {
  status: '400',
  statusDescription: 'Bad Request',
  headers: {},
};

const serverErrorResponse = {
  status: '500',
  statusDescription: 'Internal Server Error',
  headers: {},
};

exports.handler = async (event, context) => {
  const body = checkInput(event);

  if (!body) {
    return clientErrorResponse;
  }

  let key;
  while (true) {
    key = `p/${randomName(8)}`;
    if (!(await keyExists(key))) {
      break;
    }
  }

  body.key = key;
  
  const params = {
    FunctionName: 'arn:aws:lambda:us-east-1:225875088858:function:AvatrProcessing:7',
    InvocationType: 'Event',
    LogType: 'None',
    ClientContext: '',
    Payload: Buffer.from(JSON.stringify(body), 'utf-8'),
    Qualifier: '7'
  };

  try {
    await lambda.invoke(params).promise();
  } catch (e) {
    console.log(e);
    return {
      status: '200',
      statusDescription: 'OK',
      headers: {},
      body: e.stack
    };
  }

  return {
    status: '200',
    statusDescription: 'OK',
    headers: {},
    body: key
  };
}