var chai = require('chai')
var index = require('../index')
var mockMarketIntel = require('./salesForceMarketIntelResponse')
var mockTaxonomy = require('./taxonomyResponse')

describe('salesforce ita country commercial translation', () => {
  let taxonomies = mockTaxonomy.taxonomies
  const mockSalesForceMarketIntel = mockMarketIntel.intel.records[0]

  it('translates id to market_intel_id', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.market_intel_id).to.eq('ka7t0000000Gn6FAAS')
  })

  it('translates Title to title', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.title).to.eq('eCommerce How-To')
  })

  it('contains source with value "COUNTRY_COMMERCIAL"', () => {
    const result = index.translate(mockSalesForceMarketIntel, 'COUNTRY_COMMERCIAL', taxonomies)
    chai.expect(result.source).to.eq('COUNTRY_COMMERCIAL')
  })

  it('contains source with value "MARKET_INSIGHT"', () => {
    const result = index.translate(mockSalesForceMarketIntel, 'MARKET_INSIGHT', taxonomies)
    chai.expect(result.source).to.eq('MARKET_INSIGHT')
  })

  it('translates Summary to summary', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.summary).contains('This page provides helpful business resources for various ecommerce sales channel-related processes, ranging from "how to develop a digital strategy" to "how to look up country taxes".')
  })

  it('translates FirstPublishedDate to first_published_date', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.first_published_date).to.eq('2017-10-04')
  })

  it('translates LastPublishedDate to last_published_date', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.last_published_date).to.eq('2019-05-09')
  })

  it('translates Public_URL__c to url', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.url).to.eq('http://www.export.gov/article?id=eCommerce-How-To')
  })

  it('translates References__c to references', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.references).to.eq('Prepared by our U.S. Embassies abroad.  With its network of 108 offices across the United States and in more than 75 countries, the U.S. Commercial Service of the U.S. Department of Commerce utilizes its global presence and international marketing expertise to help U.S. companies sell their products and services worldwide. Locate the U.S. Commercial Service trade specialist in the U.S. nearest you by visiting http://export.gov/usoffices.')
  })

  it('translates UrlName to url_name', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.url_name).to.eq('eCommerce-How-To')
  })

  it('translates DataCategoryGroupName Industries to industries', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.industries[0]).to.eq('Industry Awesome')
    chai.expect(result.industries[1]).to.eq('Industry Cool')
  })

  it('translates DataCategoryGroupName Trade_Topics to topics', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.topics[0]).to.eq('Business Registration')
    chai.expect(result.topics[1]).to.eq('Design')
  })

  it('translates DataCategoryGroupName Geographies to countries', () => {
    const result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.countries.length).to.eq(1)
    chai.expect(result.countries[0]).to.eq('FR')
  })

  it('uses Geographies to query related taxonomy terms', () => {
    let result = index.translate(mockSalesForceMarketIntel, null, taxonomies)
    chai.expect(result.trade_regions).to.eql(
      [
        'Asia Pacific Economic Cooperation',
        'NAFTA',
        'Trans Pacific Partnership'
      ]
    )
    chai.expect(result.world_regions).to.eql(
      [
        'Western Hemisphere',
        'Pacific Rim',
        'North America'
      ]
    )

    result = index.translate(mockMarketIntel.intel.records[2], null, taxonomies)
    chai.expect(result.trade_regions).to.eql([ 'Bmx Life', 'Game of Thrones' ])
    chai.expect(result.world_regions).to.eql(['Cool'])
  })
})
