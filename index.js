const sf = require('jsforce')
const AWS = require('aws-sdk')
const request = require('request')
const s3 = new AWS.S3()
const striptags = require('striptags')
const moment = require('moment')
const axios = require('axios')
require('dotenv').config()

const sfLoginUrl = process.env.SF_LOGIN_URL
const sfUsername = process.env.SF_USERNAME
const sfPassword = process.env.SF_PASSWORD
const apiKey = process.env.API_KEY
const s3Bucket = process.env.S3_BUCKET
const taxonomiesUrl = process.env.TAXONOMIES_URL

const conn = new sf.Connection({ loginUrl: sfLoginUrl })

const marketIntelConfig = {
  countryCommercial: {
    source: 'COUNTRY_COMMERCIAL',
    table: 'Country_Commercial__kav',
    s3FileName: 'ita_country_commercial.json',
    endPointMeFreshenUrl: process.env.COUNTRY_COMMERCIAL_FRESHEN_URL + apiKey
  },
  marketInsight: {
    source: 'MARKET_INSIGHT',
    table: 'Market_Insight__kav',
    s3FileName: 'ita_market_insights.json',
    endPointMeFreshenUrl: process.env.MARKET_INSIGHTS_FRESHEN_URL + apiKey
  }
}

// For development/testing purposes
exports.handler = function (event, context) {
  conn.login(sfUsername, sfPassword, async function (err, res) {
    if (err) { return console.error(err) }
    console.log('Logged into Salesforce successfully!')
    let taxonomies = await getTaxonomies()
    getMarketIntel(taxonomies, marketIntelConfig.marketInsight)
    getMarketIntel(taxonomies, marketIntelConfig.countryCommercial)
  })
}

const getTaxonomies = async () => {
  let taxonomyResults = await axios(taxonomiesUrl)
  return taxonomyResults.data
}

const marketIntelQuery = (table) => {
  return 'SELECT Id, ' +
    'Atom__c, ' +
    'FirstPublishedDate, ' +
    'LastPublishedDate, ' +
    'Public_URL__c, ' +
    'References__c, ' +
    'Summary, ' +
    'Title, ' +
    'Mobile_Title__c, ' +
    'UrlName, ' +
    'Series__r.Name, ' +
    'level_0__c, ' +
    'Level_1__c, ' +
    'Level_2__c, ' +
    'Level_3__c, ' +
    '(SELECT Id, DataCategoryName, DataCategoryGroupName FROM DataCategorySelections) ' +
    'FROM ' + table + ' ' +
    'WHERE PublishStatus = \'Online\' ' +
    'AND Language = \'en_US\' ' +
    'AND IsLatestVersion=true ' +
    'AND IsVisibleInPkb=true '
}

const getMarketIntel = (taxonomies, marketIntelConfig) => {
  console.log('Retrieving market intelligence source data: ', marketIntelConfig.source)

  var translatedCountryCommercial = []
  var query = conn.query(marketIntelQuery(marketIntelConfig.table))
    .on('record', function (record) {
      translatedCountryCommercial.push(translate(record, marketIntelConfig.source, taxonomies))
    })
    .on('end', function () {
      console.log('Total in database: ', query.totalSize, marketIntelConfig.source)
      console.log('Total fetched: ', query.totalFetched, marketIntelConfig.source)
      writeToS3Bucket(translatedCountryCommercial, marketIntelConfig)
    })
    .on('error', function (err) {
      console.error(err)
    })
    .run({ autoFetch: true })
}

const uniqueValues = (value, index, self) => {
  return self.indexOf(value) === index
}

const translate = (r, source, taxonomies) => {
  let dataCategories = {}
  if (r.DataCategorySelections && r.DataCategorySelections.records) {
    r.DataCategorySelections.records.map(r => {
      let dataCategory = r.DataCategoryName.replace(/_/g, ' ')
      if (dataCategories[r.DataCategoryGroupName] === undefined) {
        dataCategories[r.DataCategoryGroupName] = []
      }
      dataCategories[r.DataCategoryGroupName].push(dataCategory)
    })
  }

  dataCategories.trade_regions = []
  dataCategories.world_regions = []
  dataCategories.countries = []
  if (dataCategories.Geographies !== undefined) {
    const terms = dataCategories.Geographies.map(term =>
      alternateSpellingsForTaxonomyLookup[term]
        ? alternateSpellingsForTaxonomyLookup[term]
        : term)
    const taxonomiesByLabel = taxonomies.filter(taxonomy => terms.includes(taxonomy.label))

    taxonomiesByLabel.map(taxonomy => {
      if (taxonomy.type.includes('Countries')) {
        dataCategories.trade_regions.push(...taxonomy.related_terms.trade_regions)
        dataCategories.world_regions.push(...taxonomy.related_terms.world_regions)
        dataCategories.countries.push(taxonomy.annotations.iso_alpha_2)
      } else {
        if (dataCategories[taxonomy.type] === undefined) {
          dataCategories[taxonomy.type] = []
        }
        dataCategories[taxonomy.type].push(taxonomy.label)
      }
    })
  }

  if (dataCategories['Trade Regions'] === undefined) dataCategories['Trade Regions'] = []
  if (dataCategories['World Regions'] === undefined) dataCategories['World Regions'] = []

  let marketIntel = {
    market_intel_id: r.Id,
    source,
    title: r.Title,
    mobile_title: r.Mobile_Title__c,
    summary: r.Summary,
    body: r.Atom__c,
    first_published_date: moment(r.FirstPublishedDate, moment.ISO_8601).format('YYYY-MM-DD'),
    last_published_date: moment(r.LastPublishedDate, moment.ISO_8601).format('YYYY-MM-DD'),
    url: striptags(r.Public_URL__c),
    references: r.References__c,
    url_name: r.UrlName,
    series: (r.Series__r ? r.Series__r.Name : null),
    level_0: r.level_0__c,
    level_1: r.Level_1__c,
    level_2: r.Level_2__c,
    level_3: r.Level_3__c,
    industries: dataCategories.Industries ? dataCategories.Industries.filter(uniqueValues) : [],
    topics: dataCategories.Trade_Topics ? dataCategories.Trade_Topics.filter(uniqueValues) : [],
    countries: dataCategories.countries.filter(country => country != null),
    trade_regions: dataCategories.trade_regions.length > 0
      ? dataCategories.trade_regions.filter(uniqueValues)
      : dataCategories['Trade Regions'],
    world_regions: dataCategories.world_regions.length > 0
      ? dataCategories.world_regions.filter(uniqueValues)
      : dataCategories['World Regions']
  }

  return marketIntel
}

const writeToS3Bucket = (data, marketIntelConfig) => {
  const params = {
    Body: JSON.stringify(data, null, 2),
    Bucket: s3Bucket,
    Key: marketIntelConfig.s3FileName,
    ACL: 'public-read',
    ContentType: 'application/json'
  }
  s3.putObject(params, function (err, data) {
    if (err) { return console.error(err) }
    console.log('File uploaded successfully: ', marketIntelConfig.s3FileName)
    freshenEndpoint(marketIntelConfig.endPointMeFreshenUrl)
  })
}

const freshenEndpoint = (url) => {
  request(url, function (err, res, body) {
    if (err || (res && res.statusCode !== 200)) {
      return console.error(`An error occurred while freshening the endpoint. ${body}`)
    }
    console.log('Endpoint updated successfully: ', url)
  })
}

const alternateSpellingsForTaxonomyLookup = {
  'Gulf and Iran': 'Persian Gulf Region',
  'Oceania and Australia': 'Oceania',
  'Sub Saharan Africa': 'Sub-Saharan Africa',

  'Common Market Eastern Southern Africa': 'Common Market for Eastern and Southern Africa',
  'Economic Monetary Community Cent Africa': 'Economic and Monetary Community of Central Africa',
  'European Union 28': 'European Union - 28',
  'Global System of Trade Preferences': 'Global System of Trade Preferences among Developing Countries',
  'Org of the Petroleum Exporting Countries': 'Organization of the Petroleum Exporting Countries',
  'North American Free Trade Agreement': 'NAFTA',
  'S Asian Assc Regional Cooperation': 'South Asian Association for Regional Cooperation',

  'land Islands': 'Åland Islands',
  'Cocos Keeling Islands': 'Cocos (Keeling) Islands',
  'Congo Brazzaville': 'Congo-Brazzaville',
  'Congo Kinshasa': 'Congo-Kinshasa',
  'C te d Ivoire': 'Côte d\'Ivoire',
  'Georgia USA': 'Georgia (USA)',
  'R union': 'Réunion',
  'Saint Barth lemy': 'Saint Barthélemy',
  'Saint Helena Ascension Tristan da Cunha': 'Saint Helena Ascension and Tristan da Cunha',
  'Timor Leste': 'Timor-Leste',
  'U S Virgin Islands': 'U.S. Virgin Islands'
}

exports.translate = translate
