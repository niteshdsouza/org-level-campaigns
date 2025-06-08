// src/airtable.js - Full connection test
console.log('airtable.js file is loading...');

import Airtable from 'airtable';
console.log('Airtable imported successfully');

// Configure Airtable
Airtable.configure({
  endpointUrl: 'https://api.airtable.com',
  apiKey: import.meta.env.VITE_AIRTABLE_ACCESS_TOKEN
});

// Connect to your base
const base = Airtable.base(import.meta.env.VITE_AIRTABLE_BASE_ID);

// Export table references
export const tables = {
  campaigns: base('Campaigns'),
  listings: base('Listings'), 
  campuses: base('Campuses'),
  funds: base('Funds')
};

// Test connection function
export const testConnection = async () => {
  try {
    console.log('Testing Airtable connection...');
    
    // Try to fetch one record from Campuses table to test connection
    const records = await tables.campuses.select({
      maxRecords: 1
    }).firstPage();
    
    console.log('✅ Airtable connection successful!');
    console.log('Sample campus record:', records[0]?.fields);
    return true;
  } catch (error) {
    console.error('❌ Airtable connection failed:', error);
    return false;
  }
};

console.log('airtable.js file loaded successfully');

//REAL DATA

// Fetch all campuses from Airtable
export const fetchCampuses = async () => {
    try {
      console.log('Fetching campuses from Airtable...');
      
      const records = await tables.campuses.select({
        view: 'Grid view',
        sort: [{ field: 'CampusName', direction: 'asc' }],
        filterByFormula: '{Status} = "Active"' // Only fetch active campuses
      }).all();
      
      const campuses = records.map(record => ({
        id: record.id,
        name: record.get('CampusName'),
        address: record.get('Address'),
        status: record.get('Status'),
        // Transform for your component
        selected: false,
        selectedListings: [],
        showDropdown: false,
        availableListings: [] // We'll populate this later
      }));
      
      console.log('✅ Fetched campuses:', campuses);
      return campuses;
    } catch (error) {
      console.error('❌ Error fetching campuses:', error);
      throw error;
    }
  };

  // Fetch all listings from Airtable
export const fetchListings = async () => {
    try {
      console.log('Fetching listings from Airtable...');
      
      const records = await tables.listings.select({
        view: 'Grid view',
        sort: [{ field: 'ListingName', direction: 'asc' }],
        filterByFormula: '{Status} = "Active"' // Only fetch active listings
      }).all();
      
      const listings = records.map(record => ({
        id: record.id,
        name: record.get('ListingName'),
        type: record.get('Type'),
        status: record.get('Status'),
        // Campus is a linked field - get the array of campus IDs
        campusIds: record.get('Campus') || [] // Array of campus record IDs
      }));
      
      console.log('✅ Fetched listings:', listings);
      return listings;
    } catch (error) {
      console.error('❌ Error fetching listings:', error);
      throw error;
    }
  };

  // Create a new fund in Airtable
export const createFund = async (fundData) => {
    try {
      console.log('Creating fund in Airtable...', fundData);
      
      const record = await tables.funds.create([
        {
            fields: {
                'FundName': fundData.fundName,
                'Code': fundData.fundCode || null,
                    }
        }
      ]);
      
      const createdFund = {
        id: record[0].id,
        name: record[0].fields['FundName'],
        code: record[0].fields['Code']
      };
      
      console.log('✅ Fund created successfully:', createdFund);
      return createdFund;
      
    } catch (error) {
      console.error('❌ Error creating fund:', error);
      throw error;
    }
  };

  // Create a new campaign in Airtable and link it to a fund
export const createCampaign = async (campaignData, fundId, selectedCampusIds) => {
    try {
      console.log('Creating campaign in Airtable...', {campaignData, fundId, selectedCampusIds});
      
      // Parse financial goal - remove currency formatting
      const financialGoal = campaignData.financialGoal 
        ? parseFloat(campaignData.financialGoal.replace(/[$,]/g, '')) 
        : null;
  
      const record = await tables.campaigns.create([
        {
          fields: {
            'Campaign Name': campaignData.campaignName,
            'Description': campaignData.description,
            'FinancialGoal': financialGoal,
            'StartDate': campaignData.startDate || null,
            'EndDate': campaignData.endDate || null,
            'PhoneNumber': campaignData.phoneNumber || null,
            'EmailAddress': campaignData.emailAddress || null,
            'Status': 'Draft', // Default status
            //'CreatedDate': new Date().toISOString().split('T')[0],
            //'ModifiedDate': new Date().toISOString().split('T')[0],
            'DonationDestination': campaignData.donationDestination === 'fund' ? 'Org Fund' : 'Campus',
            'OrgFundListing': campaignData.orgFundListing ? [campaignData.orgFundListing] : null,
            'AssignedCampuses': selectedCampusIds.length > 0 ? selectedCampusIds : null,
            'Funds': [fundId] // Link to the fund we just created
          }
        }
      ]);
      
      const createdCampaign = {
        id: record[0].id,
        name: record[0].fields['Campaign Name'],
        status: record[0].fields['Status']
      };
      
      console.log('✅ Campaign created successfully:', createdCampaign);
      return createdCampaign;
      
    } catch (error) {
      console.error('❌ Error creating campaign:', error);
      throw error;
    }
  };

  // Fetch org fund listings from Airtable (where Type = "Organization")
export const fetchOrgFundListings = async () => {
    try {
      console.log('Fetching org fund listings from Airtable...');
      
      const records = await tables.listings.select({
        view: 'Grid view',
        sort: [{ field: 'ListingName', direction: 'asc' }],
        filterByFormula: 'AND({Status} = "Active", {Type} = "Organization")'
      }).all();
      
      const orgListings = records.map(record => ({
        id: record.id,
        name: record.get('ListingName'),
        type: record.get('Type'),
        status: record.get('Status')
      }));
      
      console.log('✅ Fetched org fund listings:', orgListings);
      return orgListings;
    } catch (error) {
      console.error('❌ Error fetching org fund listings:', error);
      throw error;
    }
  };

  // Fetch all campaigns from Airtable
export const fetchCampaigns = async () => {
    try {
      console.log('Fetching campaigns from Airtable...');
      
      const records = await tables.campaigns.select({
        view: 'Grid view',
        sort: [{ field: 'CreatedDate', direction: 'desc' }] // Newest first
      }).all();
      
      const campaigns = records.map(record => ({
        id: record.id,
        name: record.get('Campaign Name'),
        description: record.get('Description'),
        financialGoal: record.get('FinancialGoal') || 0,
        startDate: record.get('StartDate'),
        endDate: record.get('EndDate'),
        status: record.get('Status') || 'Draft',
        scope: record.get('Scope'),
        donationDestination: record.get('DonationDestination'),
        assignedCampuses: record.get('AssignedCampuses') || [], // Add this line
        // Hardcoded placeholder values for prototype
        raised: Math.floor(Math.random() * 50000), // Random amount for demo
        pledged: Math.floor(Math.random() * 100000) // Random amount for demo
      }));
      
      console.log('✅ Fetched campaigns:', campaigns);
      return campaigns;
    } catch (error) {
      console.error('❌ Error fetching campaigns:', error);
      throw error;
    }
  };