# lambda-country-commercial

Retrieves Country Commercial from SalesForce and stores it in ElasticSearch via (End Point Me)
http://api.trade.gov/v1/ita_faq

## Install

Clone this repository.

```
cd /to/your/template/path
npm install
```

## Usage

There are 5 available commands to use on this template. For more info and usage descriptions, see the [node-lambda](https://github.com/motdotla/node-lambda) repository.

```
cd /to/your/template/path
npm run setup # setup node-lambda files
npm run lambda # run your event handler and check output
npm run package # just generate the zip that would be uploaded to AWS
npm run deploy-staging # deploy to AWS staging
npm run deploy-production # deploy to AWS production
npm run test # unit test your code
```