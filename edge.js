const aws = require('aws-sdk');
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

const colorRegex = /^#[0-9a-f]{6}$/;
function checkInput(event) {
  if (event.Records[0].cf.request.body == null) {
    return false;
  }
  const body = event.Records[0].cf.request.body.data;

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
  if (!checkInput(event)) {
    return clientErrorResponse;
  }

  const body = event.Records[0].cf.request.body.data;

  let key;
  while (true) {
    key = `p/${randomName(8)}`;
    if (!(await keyExists(key))) {
      break;
    }
  }
  
  const params = {
    FunctionName: 'AvatrProcessing:1',
    InvocationType: 'Event',
    LogType: 'None',
    ClientContext: '',
    Payload: body,
    Qualifier: '1'
  }

  try {
    const res = await lambda.invoke(params).promise();
  } catch (e) {
    console.log(e);
    return serverErrorResponse;
  }

  return {
    status: '200',
    statusDescription: 'OK',
    headers: {},
    body: key
  };
}