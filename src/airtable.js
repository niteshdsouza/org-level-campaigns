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
    funds: base('Funds'),
    pledges: base('Pledges'),
    gifts: base('Gifts'),
    people: base('People')
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
            'Status': 'Published', // Default status
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

// Fetch all campaigns with real pledge and gift data
export const fetchCampaigns = async () => {
    try {
      console.log('Fetching campaigns with real pledge/gift data...');
      
      // Fetch all data in parallel
      const [campaignRecords, pledges, gifts, campuses] = await Promise.all([
        tables.campaigns.select({
          view: 'Grid view',
          sort: [{ field: 'CreatedDate', direction: 'desc' }]
        }).all(),
        fetchPledges(),
        fetchGifts(),
        fetchCampuses() // ADD: Fetch campuses to build breakdown with names
      ]);
      
      const campaigns = campaignRecords.map(record => {
        const campaignId = record.id;
        
        // Calculate real stats for this campaign
        const stats = calculateCampaignStats(campaignId, pledges, gifts);
        
        // NEW: Build campus breakdown with names (same as fetchCampaignById)
        const campusBreakdown = Object.entries(stats.campusStats).map(([campusId, data]) => {
          const campus = campuses.find(c => c.id === campusId);
          return {
            campusId,
            campusName: campus?.name || 'Unknown Campus',
            pledged: data.pledged,
            raised: data.raised,
            pledgeCount: pledges.filter(p => p.campaignId === campaignId && p.campusId === campusId).length,
            giftCount: gifts.filter(g => g.campaignId === campaignId && g.campusId === campusId).length
          };
        });
        
        return {
          id: campaignId,
          name: record.get('Campaign Name'),
          description: record.get('Description'),
          financialGoal: (() => {
            const goal = record.get('FinancialGoal');
            console.log(`Campaign ${record.get('Campaign Name')} - Raw FinancialGoal from Airtable:`, goal, typeof goal);
            return goal || 0;
          })(),
          startDate: record.get('StartDate'),
          endDate: record.get('EndDate'),
          status: record.get('Status') || 'Draft',
          scope: record.get('Scope'),
          donationDestination: record.get('DonationDestination'),
          assignedCampuses: record.get('AssignedCampuses') || [],
          orgFundListing: record.get('OrgFundListing'),
          // Real calculated data instead of random numbers
          raised: stats.totalRaised,
          pledged: stats.totalPledged,
          giftCount: stats.giftCount,
          pledgeCount: stats.pledgeCount,
          campusStats: stats.campusStats, // Keep for backward compatibility
          campusBreakdown: campusBreakdown // NEW: Add the same field as fetchCampaignById
        };
      });
      
      console.log('✅ Fetched campaigns with real data and campus breakdown:', campaigns);
      return campaigns;
    } catch (error) {
      console.error('❌ Error fetching campaigns:', error);
      throw error;
    }
  };

  // Fetch all pledges from Airtable
export const fetchPledges = async () => {
    try {
      console.log('Fetching pledges from Airtable...');
      
      const records = await tables.pledges.select({
        view: 'Grid view',
        sort: [{ field: 'PledgeDate', direction: 'desc' }]
      }).all();
      
      const pledges = records.map(record => ({
        id: record.id,
        campaignId: record.get('Campaign') ? record.get('Campaign')[0] : null, // Linked field
        campusId: record.get('PledgeCampus') ? record.get('PledgeCampus')[0] : null, // Linked field
        donorId: record.get('Donor') ? record.get('Donor')[0] : null, // Linked field
        amount: record.get('Amount') || 0,
        date: record.get('PledgeDate'), // Fixed field name
        notes: record.get('Notes')
      }));
      
      console.log('✅ Fetched pledges:', pledges);
      return pledges;
    } catch (error) {
      console.error('❌ Error fetching pledges:', error);
      throw error;
    }
  };
  
  // Fetch all gifts from Airtable
  export const fetchGifts = async () => {
    try {
      console.log('Fetching gifts from Airtable...');
      
      const records = await tables.gifts.select({
        view: 'Grid view',
        sort: [{ field: 'GiftDate', direction: 'desc' }]
      }).all();
      
      const gifts = records.map(record => ({
        id: record.id,
        campaignId: record.get('Campaign') ? record.get('Campaign')[0] : null, // Linked field
        campusId: record.get('GiftCampus') ? record.get('GiftCampus')[0] : null, // Fixed field name
        donorId: record.get('Donor') ? record.get('Donor')[0] : null, // Linked field
        amount: record.get('Amount') || 0,
        date: record.get('GiftDate') // Fixed field name
      }));
      
      console.log('✅ Fetched gifts:', gifts);
      return gifts;
    } catch (error) {
      console.error('❌ Error fetching gifts:', error);
      throw error;
    }
  };

  // Calculate campaign statistics from pledges and gifts
export const calculateCampaignStats = (campaignId, pledges, gifts) => {
    // Filter pledges and gifts for this campaign
    const campaignPledges = pledges.filter(pledge => pledge.campaignId === campaignId);
    const campaignGifts = gifts.filter(gift => gift.campaignId === campaignId);
    
    // Calculate totals
    const totalPledged = campaignPledges.reduce((sum, pledge) => sum + pledge.amount, 0);
    const totalRaised = campaignGifts.reduce((sum, gift) => sum + gift.amount, 0);
    
    // Calculate campus breakdown
    const campusStats = {};
    
    // Add pledge data by campus
    campaignPledges.forEach(pledge => {
      if (pledge.campusId) {
        if (!campusStats[pledge.campusId]) {
          campusStats[pledge.campusId] = { pledged: 0, raised: 0 };
        }
        campusStats[pledge.campusId].pledged += pledge.amount;
      }
    });
    
    // Add gift data by campus
    campaignGifts.forEach(gift => {
      if (gift.campusId) {
        if (!campusStats[gift.campusId]) {
          campusStats[gift.campusId] = { pledged: 0, raised: 0 };
        }
        campusStats[gift.campusId].raised += gift.amount;
      }
    });
    
    return {
      totalPledged,
      totalRaised,
      pledgeCount: campaignPledges.length,
      giftCount: campaignGifts.length,
      campusStats
    };
  };

  // Fetch a single campaign with all its pledge/gift data
export const fetchCampaignById = async (campaignId) => {
    try {
      console.log('Fetching campaign by ID:', campaignId);
      
      // Fetch campaign details, pledges, and gifts in parallel
      const [campaignRecord, pledges, gifts, campuses] = await Promise.all([
        tables.campaigns.find(campaignId),
        fetchPledges(),
        fetchGifts(),
        fetchCampuses()
      ]);
      
      // Calculate stats for this specific campaign
      const stats = calculateCampaignStats(campaignId, pledges, gifts);
      
      // Build campus breakdown with names
      const campusBreakdown = Object.entries(stats.campusStats).map(([campusId, data]) => {
        const campus = campuses.find(c => c.id === campusId);
        return {
          campusId,
          campusName: campus?.name || 'Unknown Campus',
          pledged: data.pledged,
          raised: data.raised,
          pledgeCount: pledges.filter(p => p.campaignId === campaignId && p.campusId === campusId).length,
          giftCount: gifts.filter(g => g.campaignId === campaignId && g.campusId === campusId).length
        };
      });
      
      const campaign = {
        id: campaignRecord.id,
        name: campaignRecord.get('Campaign Name'),
        description: campaignRecord.get('Description'),
        financialGoal: campaignRecord.get('FinancialGoal') || 0,
        startDate: campaignRecord.get('StartDate'),
        endDate: campaignRecord.get('EndDate'),
        status: campaignRecord.get('Status') || 'Draft',
        scope: campaignRecord.get('Scope'),
        donationDestination: campaignRecord.get('DonationDestination'),
        assignedCampuses: campaignRecord.get('AssignedCampuses') || [],
        // Real calculated data
        totalRaised: stats.totalRaised,
        totalPledged: stats.totalPledged,
        giftCount: stats.giftCount,
        pledgeCount: stats.pledgeCount,
        campusBreakdown: campusBreakdown
      };
      
      console.log('✅ Fetched campaign with details:', campaign);
      return campaign;
      
    } catch (error) {
      console.error('❌ Error fetching campaign by ID:', error);
      throw error;
    }
  };

  // Fetch donor data for a campaign with pledge/gift details
export const fetchCampaignDonors = async (campaignId) => {
    try {
      console.log('Fetching donor data for campaign:', campaignId);
      
      // Fetch all data in parallel
      const [pledges, gifts, people, campuses] = await Promise.all([
        fetchPledges(),
        fetchGifts(),
        tables.people.select({ view: 'Grid view' }).all(),
        fetchCampuses()
      ]);
      
      // Filter pledges and gifts for this campaign
      const campaignPledges = pledges.filter(pledge => pledge.campaignId === campaignId);
      const campaignGifts = gifts.filter(gift => gift.campaignId === campaignId);
      
      // Get unique donor IDs
      const pledgeDonorIds = campaignPledges.map(p => p.donorId).filter(Boolean);
      const giftDonorIds = campaignGifts.map(g => g.donorId).filter(Boolean);
      const allDonorIds = [...new Set([...pledgeDonorIds, ...giftDonorIds])];
      
      // Build donor summary
      const donors = allDonorIds.map(donorId => {
        // Find donor info
        const peopleRecord = people.find(person => person.id === donorId);
        if (!peopleRecord) return null;
        
        // Calculate totals for this donor
        const donorPledges = campaignPledges.filter(p => p.donorId === donorId);
        const donorGifts = campaignGifts.filter(g => g.donorId === donorId);
        
        const totalPledged = donorPledges.reduce((sum, pledge) => sum + pledge.amount, 0);
        const totalGiven = donorGifts.reduce((sum, gift) => sum + gift.amount, 0);
        
        // Get campus info (from pledges or gifts)
        const campusIds = [...new Set([
          ...donorPledges.map(p => p.campusId).filter(Boolean),
          ...donorGifts.map(g => g.campusId).filter(Boolean)
        ])];
        
        // Get most recent pledge date
            const pledgeDates = donorPledges.map(p => p.date).filter(Boolean);
            const mostRecentPledgeDate = pledgeDates.length > 0 
            ? pledgeDates.sort((a, b) => new Date(b) - new Date(a))[0]
            : null;

            // Calculate remaining amount (pledged - given, minimum 0)
            const remaining = Math.max(0, totalPledged - totalGiven);

            return {
            donorId: donorId,
            name: peopleRecord.get('Name') || 'Unknown',
            email: peopleRecord.get('Email') || '',
            homeCampus: (() => {
                const homeCampusId = peopleRecord.get('HomeCampus');
                if (homeCampusId && homeCampusId.length > 0) {
                  const campus = campuses.find(c => c.id === homeCampusId[0]);
                  return campus ? campus.name : 'Unknown Campus';
                }
                return '';
              })(),
            datePledged: mostRecentPledgeDate,
            pledgedAmount: totalPledged,
            givenAmount: totalGiven,
            remaining: remaining,
            progress: totalPledged > 0 ? (totalGiven / totalPledged) * 100 : 0,
            pledgeCount: donorPledges.length,
            giftCount: donorGifts.length,
            campusIds: campusIds,
            lastActivity: Math.max(
                ...donorPledges.map(p => new Date(p.date || 0).getTime()),
                ...donorGifts.map(g => new Date(g.date || 0).getTime())
            )
            };
      }).filter(Boolean);
      
      // Sort by total given (highest first)
      donors.sort((a, b) => b.totalGiven - a.totalGiven);
      
      console.log('✅ Fetched donor data:', donors);
      return donors;
      
    } catch (error) {
      console.error('❌ Error fetching donor data:', error);
      throw error;
    }
  };

  // Update campaign status in Airtable
export const updateCampaignStatus = async (campaignId, newStatus) => {
    try {
      console.log('Updating campaign status:', campaignId, 'to', newStatus);
      
      const record = await tables.campaigns.update([
        {
          id: campaignId,
          fields: {
            'Status': newStatus
          }
        }
      ]);
      
      console.log('✅ Campaign status updated successfully');
      return record[0];
      
    } catch (error) {
      console.error('❌ Error updating campaign status:', error);
      throw error;
    }
  };

 // Add this function to your existing airtable.js file

// Check if a pledge already exists for this donor, campaign, and campus
export const checkExistingPledge = async (donorEmail, campaignId, campusId) => {
  try {
    console.log('Checking for existing pledge:', { donorEmail, campaignId, campusId });
    
    // First, find the donor by email
    const donorRecords = await tables.people.select({
      filterByFormula: `{Email} = "${donorEmail}"`
    }).all();
    
    if (donorRecords.length === 0) {
      console.log('✅ No existing donor found, pledge check passed');
      return { exists: false };
    }
    
    const donorId = donorRecords[0].id;
    console.log('Found donor ID:', donorId);
    
    // Get all pledges and filter manually for more reliable checking
    const allPledges = await tables.pledges.select({
      view: 'Grid view'
    }).all();
    
    // Filter pledges manually to find matches
    const existingPledges = allPledges.filter(pledgeRecord => {
      const pledgeDonorIds = pledgeRecord.get('Donor') || [];
      const pledgeCampaignIds = pledgeRecord.get('Campaign') || [];
      const pledgeCampusIds = pledgeRecord.get('PledgeCampus') || [];
      
      console.log('Checking pledge:', {
        pledgeId: pledgeRecord.id,
        pledgeDonorIds,
        pledgeCampaignIds,
        pledgeCampusIds,
        lookingFor: { donorId, campaignId, campusId }
      });
      
      const donorMatch = pledgeDonorIds.includes(donorId);
      const campaignMatch = pledgeCampaignIds.includes(campaignId);
      const campusMatch = pledgeCampusIds.includes(campusId);
      
      return donorMatch && campaignMatch && campusMatch;
    });
    
    if (existingPledges.length > 0) {
      const existingPledge = existingPledges[0];
      console.log('❌ Existing pledge found:', existingPledge.id);
      
      return {
        exists: true,
        pledgeId: existingPledge.id,
        amount: existingPledge.get('Amount'),
        type: existingPledge.get('PledgeType'),
        date: existingPledge.get('PledgeDate')
      };
    }
    
    console.log('✅ No existing pledge found, validation passed');
    return { exists: false };
    
  } catch (error) {
    console.error('❌ Error checking existing pledge:', error);
    // If there's an error checking, allow the pledge to proceed
    return { exists: false };
  }
};

// Create or find a donor in the People table, then create a pledge
export const createPledge = async (pledgeData) => {
  try {
    console.log('Creating pledge in Airtable...', pledgeData);
    
    // Step 1: Find or create donor in People table
    let donorId = await findOrCreateDonor(pledgeData.donorName, pledgeData.donorEmail);
    
    // Step 2: Create the pledge record
    const pledgeRecord = await tables.pledges.create([
      {
        fields: {
          'Donor': [donorId], // Link to People table
          'PledgeCampus': [pledgeData.campusId], // Link to Campuses table
          'Campaign': [pledgeData.campaignId], // Link to Campaigns table
          'Amount': parseFloat(pledgeData.pledgeAmount),
          'PledgeDate': pledgeData.startDate,
          'Notes': pledgeData.notes || '',
          'PledgeType': pledgeData.pledgeType === 'one-time' ? 'One-time' : 'Recurring',
          // CORRECTED: Use the frequency passed from the form
          'RecurringFrequency': pledgeData.pledgeType === 'regular' ? pledgeData.recurringFrequency : null,
          'PledgeEndDate': pledgeData.pledgeType === 'regular' ? pledgeData.endDate : null
        }
      }
    ]);
    
    const createdPledge = {
      id: pledgeRecord[0].id,
      amount: pledgeRecord[0].fields['Amount'],
      type: pledgeRecord[0].fields['PledgeType'],
      date: pledgeRecord[0].fields['PledgeDate']
    };
    
    console.log('✅ Pledge created successfully:', createdPledge);
    return createdPledge;
    
  } catch (error) {
    console.error('❌ Error creating pledge:', error);
    throw error;
  }
};

// Helper function to find or create a donor in the People table
export const findOrCreateDonor = async (donorName, donorEmail) => {
  try {
    console.log('Finding or creating donor:', donorName, donorEmail);
    
    // First, try to find existing donor by email
    const existingRecords = await tables.people.select({
      filterByFormula: `{Email} = "${donorEmail}"`
    }).all();
    
    if (existingRecords.length > 0) {
      console.log('✅ Found existing donor:', existingRecords[0].id);
      return existingRecords[0].id;
    }
    
    // If no existing donor found, create a new one
    console.log('Creating new donor...');
    const newDonorRecord = await tables.people.create([
      {
        fields: {
          'Name': donorName,
          'Email': donorEmail
          // Add other fields as needed based on your People table structure
        }
      }
    ]);
    
    console.log('✅ Created new donor:', newDonorRecord[0].id);
    return newDonorRecord[0].id;
    
  } catch (error) {
    console.error('❌ Error finding/creating donor:', error);
    throw error;
  }
};


// Create a gift record in Airtable
export const createGift = async (giftData) => {
  try {
    console.log('Creating gift in Airtable...', giftData);

    // Step 1: Find or create the donor
    const donorId = await findOrCreateDonor(giftData.donorName, giftData.donorEmail);

    // Step 2: Prepare the gift record fields
    const fields = {
      'Donor': [donorId],
      'Amount': parseFloat(giftData.amount),
      'GiftDate': new Date().toISOString().split('T')[0],
      'Campaign': [giftData.campaignId],
      'GiftCampus': [giftData.campusId],
      'GiftType': giftData.giftType || 'One-time',
    };

    // CORRECTED: Conditionally add the RecurringFrequency field
    if (giftData.giftType === 'Recurring') {
      fields['RecurringFrequency'] = giftData.recurringFrequency;
    }

    // Step 3: Create the gift record
    const record = await tables.gifts.create([{ fields }]);

    const createdGift = {
      id: record[0].id,
      amount: record[0].fields['Amount']
    };

    console.log('✅ Gift created successfully:', createdGift);
    return createdGift;

  } catch (error) {
    console.error('❌ Error creating gift:', error);
    throw error;
  }
};