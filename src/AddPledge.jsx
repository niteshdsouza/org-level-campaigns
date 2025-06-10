import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import './AddPledge.css';
import { fetchCampaigns, fetchCampuses, tables } from './airtable';

function AddPledge({ userRole, userCampuses }) {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('');
  const [memberName, setMemberName] = useState('');
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledgeDate, setPledgeDate] = useState('');
  
  // NEW: Pledge type and recurring fields
  const [pledgeType, setPledgeType] = useState('One-time');
  const [recurringFrequency, setRecurringFrequency] = useState('');
  const [pledgeEndDate, setPledgeEndDate] = useState('');
  
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberData, setNewMemberData] = useState({ name: '', email: '' });
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [showRecentPledges, setShowRecentPledges] = useState(true);
  
  // States for pledge creation and duplicate handling
  const [isCreatingPledge, setIsCreatingPledge] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [existingPledge, setExistingPledge] = useState(null);
  const [isUpdatingPledge, setIsUpdatingPledge] = useState(false);
  
  // States for recent pledges
  const [recentPledges, setRecentPledges] = useState([]);
  const [loadingRecentPledges, setLoadingRecentPledges] = useState(true);
  const [pledgesCurrentPage, setPledgesCurrentPage] = useState(1);
  const [totalPledges, setTotalPledges] = useState(0);
  const pledgesPerPage = 20;

  // Handle pledge type change
  const handlePledgeTypeChange = (type) => {
    setPledgeType(type);
    // Reset recurring fields when switching to one-time
    if (type === 'One-time') {
      setRecurringFrequency('');
      setPledgeEndDate('');
    }
  };

  // Calculate number of periods between two dates
  const calculatePeriods = (startDate, endDate, frequency) => {
    if (!startDate || !endDate || !frequency) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end <= start) return 1; // Minimum 1 period
    
    let periods = 0;
    
    switch (frequency) {
      case 'Monthly':
        periods = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth());
        break;
      case 'Quarterly':
        const quartersDiff = Math.floor(
          ((end.getFullYear() - start.getFullYear()) * 12 + 
           (end.getMonth() - start.getMonth())) / 3
        );
        periods = quartersDiff;
        break;
      case 'Annually':
        periods = end.getFullYear() - start.getFullYear();
        break;
      default:
        periods = 0;
    }
    
    return Math.max(1, periods); // Minimum 1 period
  };

  // Calculate total pledge amount for recurring pledges
  const calculateTotalAmount = () => {
    if (pledgeType !== 'Recurring' || !pledgeAmount || !pledgeDate || !pledgeEndDate || !recurringFrequency) {
      return null;
    }
    
    const perPeriodAmount = parseFloat(pledgeAmount.replace(/[$,]/g, ''));
    if (isNaN(perPeriodAmount)) return null;
    
    const periods = calculatePeriods(pledgeDate, pledgeEndDate, recurringFrequency);
    return perPeriodAmount * periods;
  };

  const totalAmount = calculateTotalAmount();

  // Load campaigns and campuses from Airtable
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingCampaigns(true);
        setLoadingCampuses(true);
        
        // Set default pledge date to today
        const today = new Date().toISOString().split('T')[0];
        setPledgeDate(today);
        
        // Fetch both campaigns and campuses from Airtable FIRST
        const [campaignData, campusData] = await Promise.all([
          fetchCampaigns(),
          fetchCampuses()
        ]);
        
        // Set campuses data immediately
        setCampuses(campusData);
        setLoadingCampuses(false);
        
        // Filter campaigns based on user role
        let filteredCampaigns;
        
        if (userRole === 'org-admin') {
          // Org admin sees all campaigns
          filteredCampaigns = campaignData;
        } else if (userRole === 'single-campus' || userRole === 'multi-campus') {
          // Campus admins only see campaigns assigned to their campuses
          filteredCampaigns = campaignData.filter(campaign => {
            return campaign.assignedCampuses && 
                   campaign.assignedCampuses.some(campusId => userCampuses.includes(campusId));
          });
        } else {
          filteredCampaigns = campaignData;
        }
        
        // Filter by status - only Published or Draft campaigns
        const statusFilteredCampaigns = filteredCampaigns.filter(campaign => {
          const status = campaign.status || 'Draft';
          return status === 'Published' || status === 'Draft';
        });
        
        // Set campaigns data
        setCampaigns(statusFilteredCampaigns);
        setLoadingCampaigns(false);
        
        // Auto-select first campaign if available
        if (statusFilteredCampaigns.length > 0) {
          setSelectedCampaign(statusFilteredCampaigns[0].id);
        }
        
        // FIXED: Load recent pledges AFTER campaigns and campuses are set
        // This ensures the lookup will work properly
        await loadRecentPledges();
        
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoadingCampaigns(false);
        setLoadingCampuses(false);
      }
    };
    
    loadData();
  }, [userRole, userCampuses]);

  // Load recent pledges from Airtable
  const loadRecentPledges = async (page = 1) => {
    try {
      setLoadingRecentPledges(true);
      
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      console.log('Loading pledges from:', cutoffDate);
      
      // First, get total count for pagination
      const allRecords = await tables.pledges.select({
        view: 'Grid view',
        filterByFormula: `IS_AFTER({PledgeDate}, "${cutoffDate}")`,
      }).all();
      
      setTotalPledges(allRecords.length);
      
      // Now get paginated results
      const offset = (page - 1) * pledgesPerPage;
      const records = await tables.pledges.select({
        view: 'Grid view',
        filterByFormula: `IS_AFTER({PledgeDate}, "${cutoffDate}")`,
        sort: [{ field: 'PledgeDate', direction: 'desc' }],
        maxRecords: pledgesPerPage,
        ...(offset > 0 && { offset: offset }) // Only add offset if > 0
      }).all();
  
      console.log(`Loaded ${records.length} pledges for page ${page}`);
  
      // FIXED: Ensure we have fresh campaign and campus data
      let currentCampaigns = campaigns;
      let currentCampuses = campuses;
      
      // If campaigns or campuses are empty, fetch them fresh
      if (campaigns.length === 0 || campuses.length === 0) {
        console.log('Fetching fresh campaign and campus data...');
        const [freshCampaigns, freshCampuses] = await Promise.all([
          fetchCampaigns(),
          fetchCampuses()
        ]);
        currentCampaigns = freshCampaigns;
        currentCampuses = freshCampuses;
      }
  
      const pledgesData = records.map(record => {
        // Get linked record data
        const donorId = record.get('Donor')?.[0];
        const campaignId = record.get('Campaign')?.[0];
        const campusId = record.get('PledgeCampus')?.[0];
        
        // Find the actual names from our current data
        const donor = donorId ? { id: donorId, name: 'Loading...', email: '' } : null;
        const campaign = currentCampaigns.find(c => c.id === campaignId);
        const campus = currentCampuses.find(c => c.id === campusId);
        
        return {
          id: record.id,
          donorId: donorId,
          donor: donor,
          campaign: campaign ? campaign.name : 'Unknown Campaign',
          campus: campus ? campus.name : 'Unknown Campus',
          amount: record.get('Amount') || 0,
          pledgeDate: record.get('PledgeDate') || '',
          notes: record.get('Notes') || '',
          // NEW: Include the new fields in the display
          pledgeType: record.get('PledgeType') || 'One-time',
          recurringFrequency: record.get('RecurringFrequency') || '',
          pledgeEndDate: record.get('PledgeEndDate') || ''
        };
      });
  
      // Now fetch donor details for each pledge
      const pledgesWithDonors = await Promise.all(
        pledgesData.map(async (pledge) => {
          if (pledge.donorId) {
            try {
              const donorRecord = await tables.people.find(pledge.donorId);
              return {
                ...pledge,
                donor: {
                  id: pledge.donorId,
                  name: donorRecord.get('Name') || 'Unknown',
                  email: donorRecord.get('Email') || ''
                }
              };
            } catch (error) {
              console.error('Error fetching donor:', error);
              return pledge;
            }
          }
          return pledge;
        })
      );
  
      setRecentPledges(pledgesWithDonors);
      setPledgesCurrentPage(page);
      
    } catch (error) {
      console.error('Error loading recent pledges:', error);
      setRecentPledges([]);
      setTotalPledges(0);
    } finally {
      setLoadingRecentPledges(false);
    }
  };

  // Reload recent pledges after creating/updating a pledge
  const refreshRecentPledges = async () => {
    await loadRecentPledges(pledgesCurrentPage);
  };

  // Handle pagination
  const handlePledgesPageChange = (newPage) => {
    loadRecentPledges(newPage);
  };

  // Delete pledge function
  const handleDeletePledge = async (pledgeId) => {
    if (!window.confirm('Are you sure you want to delete this pledge?')) {
      return;
    }

    try {
      await tables.pledges.destroy([pledgeId]);
      console.log('✅ Pledge deleted successfully');
      
      // Refresh the recent pledges list
      await refreshRecentPledges();
      
    } catch (error) {
      console.error('❌ Error deleting pledge:', error);
      alert('Error deleting pledge. Please try again.');
    }
  };

  // Search members in Airtable
  const searchMembers = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setMemberSearchResults([]);
      setShowMemberDropdown(false);
      return;
    }

    try {
      setIsSearchingMembers(true);
      
      const records = await tables.people.select({
        view: 'Grid view',
        filterByFormula: `OR(
          SEARCH("${searchTerm.toLowerCase()}", LOWER({Name})),
          SEARCH("${searchTerm.toLowerCase()}", LOWER({Email}))
        )`,
        maxRecords: 10,
        sort: [{ field: 'Name', direction: 'asc' }]
      }).all();

      const members = records.map(record => ({
        id: record.id,
        name: record.get('Name') || 'Unknown',
        email: record.get('Email') || '',
        homeCampus: (() => {
          const homeCampusId = record.get('HomeCampus');
          if (homeCampusId && homeCampusId.length > 0) {
            const campus = campuses.find(c => c.id === homeCampusId[0]);
            return campus ? campus.name : '';
          }
          return '';
        })()
      }));

      setMemberSearchResults(members);
      setShowMemberDropdown(true);
      
    } catch (error) {
      console.error('Error searching members:', error);
      setMemberSearchResults([]);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  // Handle member input change
  const handleMemberInputChange = (value) => {
    setMemberName(value);
    setSelectedMember(null);
    
    // Debounce search
    clearTimeout(window.memberSearchTimeout);
    window.memberSearchTimeout = setTimeout(() => {
      searchMembers(value);
    }, 300);
  };

  // Handle member selection
  const handleMemberSelect = (member) => {
    setSelectedMember(member);
    setMemberName(member.name);
    setShowMemberDropdown(false);
    setMemberSearchResults([]);
  };

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.member-search-container')) {
        setShowMemberDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Create new member in Airtable
  const createNewMember = async (memberData) => {
    try {
      setIsCreatingMember(true);
      
      const record = await tables.people.create([
        {
          fields: {
            'Name': memberData.name,
            'Email': memberData.email
          }
        }
      ]);

      const newMember = {
        id: record[0].id,
        name: record[0].fields['Name'],
        email: record[0].fields['Email'] || '',
        homeCampus: ''
      };

      console.log('✅ New member created:', newMember);
      return newMember;
      
    } catch (error) {
      console.error('❌ Error creating member:', error);
      throw error;
    } finally {
      setIsCreatingMember(false);
    }
  };

  // Handle add new member modal
  const handleAddNewMember = (suggestedName = '') => {
    setNewMemberData({ 
      name: suggestedName, 
      email: '' 
    });
    setShowAddMemberModal(true);
    setShowMemberDropdown(false);
  };

  // Handle new member form submission
  const handleNewMemberSubmit = async (e) => {
    e.preventDefault();
    
    if (!newMemberData.name.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      const newMember = await createNewMember(newMemberData);
      
      // Automatically select the newly created member
      handleMemberSelect(newMember);
      
      // Close modal and reset form
      setShowAddMemberModal(false);
      setNewMemberData({ name: '', email: '' });
      
    } catch (error) {
      alert('Error creating member. Please try again.');
    }
  };

  // Handle closing the modal
  const handleCloseModal = () => {
    setShowAddMemberModal(false);
    setNewMemberData({ name: '', email: '' });
  };

  // Check for existing pledges
  const checkForExistingPledge = async (donorId, campaignId) => {
    try {
      console.log('🔍 Checking for existing pledge...');
      console.log('Donor ID:', donorId);
      console.log('Campaign ID:', campaignId);
      
      // First, let's try a simple approach - get all pledges and filter manually
      const allRecords = await tables.pledges.select({
        view: 'Grid view'
      }).all();
      
      console.log('Total pledges in table:', allRecords.length);
      
      // Manual filtering to debug
      const matchingPledges = allRecords.filter(record => {
        const recordDonor = record.get('Donor');
        const recordCampaign = record.get('Campaign');
        
        console.log('Record:', {
          id: record.id,
          donor: recordDonor,
          campaign: recordCampaign,
          donorMatch: recordDonor && recordDonor.includes(donorId),
          campaignMatch: recordCampaign && recordCampaign.includes(campaignId)
        });
        
        return recordDonor && recordDonor.includes(donorId) && 
               recordCampaign && recordCampaign.includes(campaignId);
      });
      
      console.log('Matching pledges found:', matchingPledges.length);

      if (matchingPledges.length > 0) {
        const record = matchingPledges[0];
        console.log('✅ Found existing pledge:', record.id);
        return {
          id: record.id,
          amount: record.get('Amount') || 0,
          pledgeDate: record.get('PledgeDate') || '',
          notes: record.get('Notes') || ''
        };
      }
      
      console.log('❌ No existing pledge found');
      return null;
    } catch (error) {
      console.error('Error checking for existing pledge:', error);
      throw error;
    }
  };

  // Create pledge in Airtable
  const createPledge = async (pledgeData) => {
    try {
      // Build the fields object with new fields
      const fields = {
        'Donor': [pledgeData.donorId], // Array for linked record
        'PledgeCampus': [pledgeData.campusId], // Array for linked record
        'Campaign': [pledgeData.campaignId], // Array for linked record
        'Amount': pledgeData.amount,
        'PledgeDate': pledgeData.pledgeDate,
        'Notes': pledgeData.notes || '',
        // NEW: Add the new fields
        'PledgeType': pledgeData.pledgeType,
      };

      // Only add recurring fields if pledge type is recurring
      if (pledgeData.pledgeType === 'Recurring') {
        fields['RecurringFrequency'] = pledgeData.recurringFrequency;
        if (pledgeData.pledgeEndDate) {
          fields['PledgeEndDate'] = pledgeData.pledgeEndDate;
        }
      }

      const record = await tables.pledges.create([
        {
          fields: fields
        }
      ]);

      console.log('✅ Pledge created successfully:', record[0].id);
      return record[0];
      
    } catch (error) {
      console.error('❌ Error creating pledge:', error);
      throw error;
    }
  };

  // Update existing pledge
  const updatePledge = async (pledgeId, pledgeData) => {
    try {
      // Build the fields object with new fields
      const fields = {
        'Amount': pledgeData.amount,
        'PledgeDate': pledgeData.pledgeDate,
        'PledgeCampus': [pledgeData.campusId], // Update campus if changed
        'Notes': pledgeData.notes || '',
        // NEW: Add the new fields
        'PledgeType': pledgeData.pledgeType,
      };

      // Only add recurring fields if pledge type is recurring
      if (pledgeData.pledgeType === 'Recurring') {
        fields['RecurringFrequency'] = pledgeData.recurringFrequency;
        if (pledgeData.pledgeEndDate) {
          fields['PledgeEndDate'] = pledgeData.pledgeEndDate;
        }
      } else {
        // Clear recurring fields if switching to one-time
        fields['RecurringFrequency'] = null;
        fields['PledgeEndDate'] = null;
      }

      const record = await tables.pledges.update([
        {
          id: pledgeId,
          fields: fields
        }
      ]);

      console.log('✅ Pledge updated successfully:', record[0].id);
      return record[0];
      
    } catch (error) {
      console.error('❌ Error updating pledge:', error);
      throw error;
    }
  };

  // Handle Add Pledge button click
  const handleAddPledge = async () => {
    if (!selectedMember || !selectedCampaign || !selectedCampus || !pledgeAmount || !pledgeDate) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate recurring pledge fields
    if (pledgeType === 'Recurring') {
      if (!recurringFrequency) {
        alert('Please select a recurring frequency');
        return;
      }
      if (!pledgeEndDate) {
        alert('Please select an end date for recurring pledges');
        return;
      }
    }

    try {
      setIsCreatingPledge(true);

      // Check for existing pledge
      const existing = await checkForExistingPledge(selectedMember.id, selectedCampaign);
      
      if (existing) {
        // Show duplicate modal
        setExistingPledge(existing);
        setShowDuplicateModal(true);
        setIsCreatingPledge(false);
        return;
      }

      // No duplicate found, create new pledge
      await createNewPledge();
      
    } catch (error) {
      console.error('Error processing pledge:', error);
      alert('Error processing pledge. Please try again.');
      setIsCreatingPledge(false);
    }
  };

  // Create new pledge
  const createNewPledge = async () => {
    try {
      // Calculate final amount to store
      let finalAmount;
      if (pledgeType === 'Recurring' && totalAmount) {
        finalAmount = totalAmount; // Store calculated total
      } else {
        finalAmount = parseFloat(pledgeAmount.replace(/[$,]/g, '')); // Store entered amount for one-time
      }

      const pledgeData = {
        donorId: selectedMember.id,
        campusId: selectedCampus,
        campaignId: selectedCampaign,
        amount: finalAmount,
        pledgeDate: pledgeDate,
        notes: '',
        // NEW: Include the new fields
        pledgeType: pledgeType,
        recurringFrequency: pledgeType === 'Recurring' ? recurringFrequency : null,
        pledgeEndDate: pledgeType === 'Recurring' && pledgeEndDate ? pledgeEndDate : null
      };

      await createPledge(pledgeData);
      
      // Success! Reset form
      alert('Pledge added successfully!');
      handleReset();
      
      // Refresh recent pledges
      await refreshRecentPledges();
      
    } catch (error) {
      console.error('Error creating pledge:', error);
      alert('Error creating pledge. Please try again.');
    } finally {
      setIsCreatingPledge(false);
    }
  };

  // Handle update existing pledge
  const handleUpdateExistingPledge = async () => {
    try {
      setIsUpdatingPledge(true);

      // Calculate final amount to store
      let finalAmount;
      if (pledgeType === 'Recurring' && totalAmount) {
        finalAmount = totalAmount; // Store calculated total
      } else {
        finalAmount = parseFloat(pledgeAmount.replace(/[$,]/g, '')); // Store entered amount for one-time
      }

      const pledgeData = {
        campusId: selectedCampus,
        amount: finalAmount,
        pledgeDate: pledgeDate,
        notes: '',
        // NEW: Include the new fields
        pledgeType: pledgeType,
        recurringFrequency: pledgeType === 'Recurring' ? recurringFrequency : null,
        pledgeEndDate: pledgeType === 'Recurring' && pledgeEndDate ? pledgeEndDate : null
      };

      await updatePledge(existingPledge.id, pledgeData);
      
      // Success! Reset form and close modal
      alert('Pledge updated successfully!');
      setShowDuplicateModal(false);
      setExistingPledge(null);
      handleReset();
      
      // Refresh recent pledges
      await refreshRecentPledges();
      
    } catch (error) {
      console.error('Error updating pledge:', error);
      alert('Error updating pledge. Please try again.');
    } finally {
      setIsUpdatingPledge(false);
    }
  };

  // Handle close duplicate modal
  const handleCloseDuplicateModal = () => {
    setShowDuplicateModal(false);
    setExistingPledge(null);
    setIsCreatingPledge(false);
  };

  // Get available campuses for selected campaign
  const getAvailableCampuses = () => {
    if (!selectedCampaign) return [];
    
    const campaign = campaigns.find(c => c.id === selectedCampaign);
    if (!campaign) return [];
    
    // Use real campus data from Airtable
    if (campaign.assignedCampuses && campaign.assignedCampuses.length > 0) {
      return campuses.filter(campus => 
        campaign.assignedCampuses.includes(campus.id)
      );
    }
    
    // Fallback: if no assignedCampuses field, show all campuses
    return campuses;
  };

  const availableCampuses = getAvailableCampuses();
  
  // Debug logging
  console.log('Selected Campaign:', selectedCampaign);
  console.log('All Campuses from Airtable:', campuses);
  console.log('Available Campuses for this campaign:', availableCampuses);
  console.log('Current Campaign Data:', campaigns.find(c => c.id === selectedCampaign));

  // Handle campaign selection change
  const handleCampaignChange = (campaignId) => {
    setSelectedCampaign(campaignId);
    setSelectedCampus(''); // Reset campus selection when campaign changes
  };

  // Define breadcrumbs
  const breadcrumbs = [
    { text: 'Campaigns', link: '/org-admin' },
    { text: 'Add a pledge' }
  ];

  const handleReset = () => {
    setMemberName('');
    setSelectedMember(null);
    setSelectedCampus('');
    setPledgeAmount('');
    setPledgeDate(new Date().toISOString().split('T')[0]); // Reset to today
    // NEW: Reset the new fields
    setPledgeType('One-time');
    setRecurringFrequency('');
    setPledgeEndDate('');
    setMemberSearchResults([]);
    setShowMemberDropdown(false);
    if (campaigns.length > 0) {
      setSelectedCampaign(campaigns[0].id);
    }
  };

  // Format currency input
  const formatCurrency = (value) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers === '') return '';
    const amount = parseInt(numbers);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handlePledgeAmountChange = (e) => {
    const formatted = formatCurrency(e.target.value);
    setPledgeAmount(formatted);
  };

  return (
    <Layout breadcrumbs={breadcrumbs} userRole={userRole} userCampuses={userCampuses}>
      <div className="add-pledge-container">
        {/* Header */}
        <div className="add-pledge-header">
          <h1>Add a pledge</h1>
        </div>

        {/* Main Form */}
        <div className="pledge-form-container">
          {/* Campaign Selection */}
          <div className="form-group">
            <label className="form-label">Choose your Campaign</label>
            <div className="select-wrapper">
              <select 
                className="campaign-select"
                value={selectedCampaign}
                onChange={(e) => handleCampaignChange(e.target.value)}
                disabled={loadingCampaigns}
              >
                {loadingCampaigns ? (
                  <option>Loading campaigns...</option>
                ) : campaigns.length === 0 ? (
                  <option>No available campaigns</option>
                ) : (
                  campaigns.map(campaign => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))
                )}
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>

          {/* Campus Selection */}
          <div className="form-group">
            <label className="form-label">Campus</label>
            <div className="select-wrapper">
              <select 
                className="campus-select"
                value={selectedCampus}
                onChange={(e) => setSelectedCampus(e.target.value)}
                disabled={!selectedCampaign || availableCampuses.length === 0 || loadingCampuses}
              >
                <option value="">
                  {loadingCampuses ? 'Loading campuses...' : 'Select a campus'}
                </option>
                {availableCampuses.map(campus => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>

          {/* Member Details with Search */}
          <div className="form-group">
            <label className="form-label">Member's details</label>
            <div className="member-search-container">
              <input
                type="text"
                className="member-input"
                placeholder="Type member's name or email"
                value={memberName}
                onChange={(e) => handleMemberInputChange(e.target.value)}
                onFocus={() => memberSearchResults.length > 0 && setShowMemberDropdown(true)}
              />
              
              {isSearchingMembers && (
                <div className="search-loading">
                  <span className="loading-spinner">⟳</span>
                  Searching...
                </div>
              )}

              {showMemberDropdown && (
                <div className="member-dropdown">
                  {memberSearchResults.length > 0 ? (
                    memberSearchResults.map((member) => (
                      <div
                        key={member.id}
                        className="member-option"
                        onClick={() => handleMemberSelect(member)}
                      >
                        <div className="member-option-main">
                          <span className="member-option-name">{member.name}</span>
                          {member.email && (
                            <span className="member-option-email">{member.email}</span>
                          )}
                        </div>
                        {member.homeCampus && (
                          <span className="member-option-campus">{member.homeCampus}</span>
                        )}
                      </div>
                    ))
                  ) : memberName.length >= 2 ? (
                    <div className="no-members-found">
                      <div className="no-members-text">
                        No members found for "{memberName}"
                      </div>
                      <button 
                        className="add-new-member-suggestion"
                        onClick={() => handleAddNewMember(memberName)}
                      >
                        <span className="add-icon">+</span>
                        Add "{memberName}" as a new member
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {selectedMember && (
                <div className="selected-member-info">
                  <span className="selected-member-icon">✓</span>
                  <span className="selected-member-text">
                    Selected: {selectedMember.name}
                    {selectedMember.email && ` (${selectedMember.email})`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* NEW: Giving Frequency (Pledge Type) with inline Recurring Frequency */}
          <div className="form-group">
            <label className="form-label">Giving frequency</label>
            <div className="giving-frequency-container">
              <div className="pledge-type-options">
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="pledgeType"
                      value="One-time"
                      checked={pledgeType === 'One-time'}
                      onChange={(e) => handlePledgeTypeChange(e.target.value)}
                    />
                    <span className="radio-label">One time</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="pledgeType"
                      value="Recurring"
                      checked={pledgeType === 'Recurring'}
                      onChange={(e) => handlePledgeTypeChange(e.target.value)}
                    />
                    <span className="radio-label">Recurring</span>
                  </label>
                </div>
              </div>

              {/* NEW: Recurring Frequency inline */}
              {pledgeType === 'Recurring' && (
                <div className="recurring-frequency-inline">
                  <div className="select-wrapper">
                    <select 
                      className="recurring-frequency-select"
                      value={recurringFrequency}
                      onChange={(e) => setRecurringFrequency(e.target.value)}
                    >
                      <option value="">Select frequency</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annually">Annually</option>
                    </select>
                    <span className="select-arrow">▼</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pledge Amount with Total Display */}
          <div className="form-group">
            <label className="form-label">Pledge Amount</label>
            <div className="pledge-amount-container">
              <input
                type="text"
                className="pledge-amount-input"
                placeholder="$0"
                value={pledgeAmount}
                onChange={handlePledgeAmountChange}
              />
              {/* Show calculated total for recurring pledges */}
              {pledgeType === 'Recurring' && totalAmount && (
                <div className="total-amount-display">
                  (${totalAmount.toLocaleString()} total)
                </div>
              )}
            </div>
          </div>

          {/* Pledge Date with inline End Date */}
          <div className="form-group">
            <div className="pledge-date-container">
              <div className="pledge-date-section">
                <label className="inline-label">Pledge Date</label>
                <input
                  type="date"
                  className="pledge-date-input"
                  value={pledgeDate}
                  onChange={(e) => setPledgeDate(e.target.value)}
                />
              </div>

              {/* NEW: End Date inline */}
              {pledgeType === 'Recurring' && (
                <div className="end-date-inline">
                  <label className="inline-label">End date</label>
                  <input
                    type="date"
                    className="pledge-end-date-input"
                    value={pledgeEndDate}
                    onChange={(e) => setPledgeEndDate(e.target.value)}
                    min={pledgeDate} // Ensure end date is after start date
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button className="btn-reset" onClick={handleReset}>
              Reset
            </button>
            <button 
              className={`btn-add-pledge ${(memberName.trim() || selectedMember) && selectedCampaign && selectedCampus && pledgeAmount && pledgeDate && (pledgeType === 'One-time' || (recurringFrequency && pledgeEndDate)) ? 'enabled' : 'disabled'}`}
              disabled={!(memberName.trim() || selectedMember) || !selectedCampaign || !selectedCampus || !pledgeAmount || !pledgeDate || (pledgeType === 'Recurring' && (!recurringFrequency || !pledgeEndDate)) || isCreatingPledge}
              onClick={handleAddPledge}
            >
              {isCreatingPledge ? (
                <>
                  <span className="loading-spinner">⟳</span>
                  Processing...
                </>
              ) : (
                'Add pledge'
              )}
            </button>
          </div>
        </div>

        {/* Recent Pledges Section */}
        {showRecentPledges && (
          <div className="recent-pledges-section">
            <div className="recent-pledges-header">
              <h2 className="recent-pledges-title">Recent pledges (Last 30 days)</h2>
              <div className="pledges-count">
                {totalPledges > 0 && (
                  <span className="count-text">
                    Showing {((pledgesCurrentPage - 1) * pledgesPerPage) + 1}-{Math.min(pledgesCurrentPage * pledgesPerPage, totalPledges)} of {totalPledges} pledges
                  </span>
                )}
              </div>
            </div>
            
            {loadingRecentPledges ? (
              <div className="loading-state">
                <span className="loading-spinner">⟳</span>
                Loading recent pledges...
              </div>
            ) : (
              <>
                <div className="pledges-table-container">
                  <table className="pledges-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email address</th>
                        <th>Date pledged</th>
                        <th>Campaign name</th>
                        <th>Campus</th>
                        <th>Type</th>
                        <th>Total pledged</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPledges.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="no-pledges-message">
                            No pledges found in the last 30 days
                          </td>
                        </tr>
                      ) : (
                        recentPledges.map((pledge) => (
                          <tr key={pledge.id}>
                            <td className="name-cell">
                              {pledge.donor?.name || 'Unknown'}
                            </td>
                            <td className="email-cell">
                              {pledge.donor?.email || ''}
                            </td>
                            <td>
                              {pledge.pledgeDate ? 
                                new Date(pledge.pledgeDate).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                }) : 
                                ''
                              }
                            </td>
                            <td className="campaign-cell">{pledge.campaign}</td>
                            <td className="campus-cell">{pledge.campus}</td>
                            <td className="type-cell">
                              <span className={`pledge-type-badge ${pledge.pledgeType?.toLowerCase()}`}>
                                {pledge.pledgeType === 'Recurring' ? (
                                  `${pledge.pledgeType} (${pledge.recurringFrequency || 'Unknown'})`
                                ) : (
                                  pledge.pledgeType || 'One-time'
                                )}
                              </span>
                            </td>
                            <td className="amount-cell">
                              ${typeof pledge.amount === 'number' ? pledge.amount.toFixed(2) : '0.00'}
                            </td>
                            <td>
                              <button 
                                className="delete-btn"
                                onClick={() => handleDeletePledge(pledge.id)}
                                title="Delete pledge"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPledges > pledgesPerPage && (
                  <div className="pledges-pagination">
                    <button 
                      className="pagination-arrow"
                      disabled={pledgesCurrentPage === 1}
                      onClick={() => handlePledgesPageChange(pledgesCurrentPage - 1)}
                    >
                      ❮ Previous
                    </button>
                    
                    <div className="pagination-info">
                      Page {pledgesCurrentPage} of {Math.ceil(totalPledges / pledgesPerPage)}
                    </div>
                    
                    <button 
                      className="pagination-arrow"
                      disabled={pledgesCurrentPage >= Math.ceil(totalPledges / pledgesPerPage)}
                      onClick={() => handlePledgesPageChange(pledgesCurrentPage + 1)}
                    >
                      Next ❯
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add New Member Modal */}
      {showAddMemberModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Member</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            
            <form onSubmit={handleNewMemberSubmit} className="modal-form">
              <div className="modal-field">
                <label className="modal-label">
                  Name <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  className="modal-input"
                  value={newMemberData.name}
                  onChange={(e) => setNewMemberData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter member's name"
                  required
                  autoFocus
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Email</label>
                <input
                  type="email"
                  className="modal-input"
                  value={newMemberData.email}
                  onChange={(e) => setNewMemberData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter member's email (optional)"
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="modal-btn-cancel"
                  onClick={handleCloseModal}
                  disabled={isCreatingMember}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="modal-btn-submit"
                  disabled={!newMemberData.name.trim() || isCreatingMember}
                >
                  {isCreatingMember ? (
                    <>
                      <span className="loading-spinner">⟳</span>
                      Creating...
                    </>
                  ) : (
                    'Add Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Pledge Modal */}
      {showDuplicateModal && existingPledge && (
        <div className="modal-overlay" onClick={handleCloseDuplicateModal}>
          <div className="modal-content duplicate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Pledge Already Exists</h2>
              <button className="modal-close" onClick={handleCloseDuplicateModal}>
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="duplicate-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-text">
                  <p><strong>{selectedMember?.name}</strong> already has a pledge for this campaign.</p>
                </div>
              </div>
              
              <div className="pledge-comparison">
                <div className="existing-pledge">
                  <h4>Current Pledge:</h4>
                  <div className="pledge-details">
                    <span className="amount">${existingPledge.amount.toFixed(2)}</span>
                    <span className="date">{new Date(existingPledge.pledgeDate).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="new-pledge">
                  <h4>New Amount:</h4>
                  <div className="pledge-details">
                    <span className="amount">
                      {pledgeType === 'Recurring' && totalAmount 
                        ? `${totalAmount.toLocaleString()}` 
                        : pledgeAmount
                      }
                    </span>
                    <span className="date">{new Date(pledgeDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <p className="update-explanation">
                Would you like to update their existing pledge with the new amount and date?
              </p>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="modal-btn-cancel"
                onClick={handleCloseDuplicateModal}
                disabled={isUpdatingPledge}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="modal-btn-submit"
                onClick={handleUpdateExistingPledge}
                disabled={isUpdatingPledge}
              >
                {isUpdatingPledge ? (
                  <>
                    <span className="loading-spinner">⟳</span>
                    Updating...
                  </>
                ) : (
                  'Update Pledge'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default AddPledge;