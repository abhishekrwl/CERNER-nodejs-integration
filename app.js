const http = require('http');
const express = require('express');
const app = express();
require('dotenv').config();
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data');

app.use(bodyParser.json({limit: "50mb"}))
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors());

app.get('/', (req, res) => {
    console.log(`First Route!`);
    res.send(`First Route!`)
})

app.get(`/cerner/launch`, async (req,res) => {
    console.log(req.query)
    let iss = req.query.iss;
    let launch = req.query.launch;
    let headers = {
        headers: {
            Accept: `application/json+fhir`
        }
    }
    let response = await axios.get(`${iss}/metadata`, headers)
    .then(data => {
        // console.log(data.data.rest[0]);
        return JSON.stringify(data.data);
    })
    .catch(e => {
        console.log(e);
    })
    response = JSON.parse(response)
    if(!response || !response.rest || !response.rest[0] || !response.rest[0].security || !response.rest[0].security.extension)
    {
        return res.send('Error in find of URLs')
    }
    let extensionArray = response.rest[0].security.extension[0].extension;
    console.log(extensionArray)
    let authorization_endpoint = ''
    let token_endpoint = ''
    for(let value of extensionArray){
        if(value.url == `authorize`){
            authorization_endpoint = value.valueUri
        }
        if(value.url == `token`){
            token_endpoint = value.valueUri
        }
    }
    console.log(authorization_endpoint);
    console.log(token_endpoint)

    let redirectURL = `${authorization_endpoint}?response_type=code&client_id=${process.env.SMART_CLIENT_ID}&redirect_uri=${process.env.BASE_URL}cerner/auth/callback&scope=patient%2FObservation.read%20patient%2FMedicationHistory.read%20launch&launch=${launch}&aud=${iss}&state=1234`
    // https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/provider/authorize?response_type=code&client_id=0aae4def-72a6-411e-88f9-1e282cdc69e5&redirect_uri=http://localhost:3000/cerner/auth/callback&scope=patient%2FObservation.read%20patient%2FMedicationHistory.read%20launch&launch=0325e548-7eb7-4da9-bed1-3592d593fa52&aud=https://fhir-ehr-code.cerner.com/dstu2/ec2458f2-1e24-41c8-b71b-0e701af7583d
    console.log(redirectURL);
    return res.redirect(redirectURL);
})

app.get('/cerner/auth/callback', async (req,res) => {
    console.log('here is the code--->')
    console.log(req.query)
    let code = req.query.code;

    var querystring = require('querystring');
    let details = await axios.post(`https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token`, querystring.stringify({
        'client_id': `0aae4def-72a6-411e-88f9-1e282cdc69e5`,
        'grant_type': 'authorization_code',
        'code': `${code}`,
        'redirect_uri': `http://localhost:3000/cerner/auth/callback`,
        "state": "1234"
    }),{headers: { 
        'Content-Type': 'application/x-www-form-urlencoded', 
    }})
    .then(function (response) {
        return JSON.stringify(response.data);
    })
    .catch(function (error) {
        console.log('error occured');
    });

    console.log(JSON.parse(details));
    details = JSON.parse(details);

    let headers = {
        headers: {
            Accept: `application/json+fhir`,
            // 'Authorization': `Bearer ${details.access_token}`
        }
    }
    // let url = `https://fhir-open.cerner.com/dstu2/ec2458f2-1e24-41c8-b71b-0e701af7583d/Patient/${details.patient}`
    let url = `https://fhir-open.cerner.com/dstu2/ec2458f2-1e24-41c8-b71b-0e701af7583d/Patient?_id=${details.patient}`
    console.log('url----------------->>', url)
    let patitentResposne = await axios.get(url, headers)
    .then(function (response) {
        return JSON.stringify(response.data);
    })
    .catch(function (error) {
        console.log('error occured');
    });

    let patientData = JSON.parse(patitentResposne)
    // console.log(patientData.text);
    // return res.send(JSON.parse(patitentResposne))
    return res.send(patientData.entry[0].resource.text.div)
})

const port = process.env.PORT || 3000
const server = http.createServer(app);
server.listen(port, () => {
    console.log(`server is running on port ${port}!`)
})
