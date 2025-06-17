import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import './AddPledge.css';
import { fetchCampaigns, fetchCampuses, tables } from './airtable';

function AddPledge({ userRole, userCampuses }) {
  const navigate = useNavigate();
  // ... (all existing state variables remain the same)
  const [campaigns, setCampaigns] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('');
  const [memberName, setMemberName] = useState('');
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [pledgeDate, setPledgeDate] = useState('');
  
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
  
  const [isCreatingPledge, setIsCreatingPledge] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [existingPledge, setExistingPledge] = useState(null);
  const [isUpdatingPledge, setIsUpdatingPledge] = useState(false);
  
  const [recentPledges, setRecentPledges] = useState([]);
  const [loadingRecentPledges, setLoadingRecentPledges] = useState(true);
  const [pledgesCurrentPage, setPledgesCurrentPage] = useState(1);
  const [totalPledges, setTotalPledges] = useState(0);
  const pledgesPerPage = 20;

  const [pledgeSearchQuery, setPledgeSearchQuery] = useState('');
  
  const [openPledgeDropdown, setOpenPledgeDropdown] = useState(null);

  // NEW: State for the delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pledgeToDelete, setPledgeToDelete] = useState(null);


  // ... (all existing functions from handlePledgeTypeChange to formatCurrency remain the same) ...
    // Handle pledge type change
    const handlePledgeTypeChange = (type) => {
        setPledgeType(type);
        if (type === 'One-time') {
          setRecurringFrequency('');
          setPledgeEndDate('');
        }
      };
    
      const calculatePeriods = (startDate, endDate, frequency) => {
        if (!startDate || !endDate || !frequency) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) return 1;
        let periods = 0;
        switch (frequency) {
          case 'Monthly':
            periods = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            break;
          case 'Quarterly':
            periods = Math.floor(((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())) / 3);
            break;
          case 'Annually':
            periods = end.getFullYear() - start.getFullYear();
            break;
          default:
            periods = 0;
        }
        return Math.max(1, periods);
      };
    
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
    
      useEffect(() => {
        const loadData = async () => {
          try {
            setLoadingCampaigns(true);
            setLoadingCampuses(true);
            const today = new Date().toISOString().split('T')[0];
            setPledgeDate(today);
            const [campaignData, campusData] = await Promise.all([fetchCampaigns(), fetchCampuses()]);
            setCampuses(campusData);
            setLoadingCampuses(false);
            let filteredCampaigns;
            if (userRole === 'org-admin') {
              filteredCampaigns = campaignData;
            } else if (userRole === 'single-campus' || userRole === 'multi-campus') {
              filteredCampaigns = campaignData.filter(campaign => campaign.assignedCampuses && campaign.assignedCampuses.some(campusId => userCampuses.includes(campusId)));
            } else {
              filteredCampaigns = campaignData;
            }
            const statusFilteredCampaigns = filteredCampaigns.filter(campaign => {
              const status = campaign.status || 'Draft';
              return status === 'Published' || status === 'Draft';
            });
            setCampaigns(statusFilteredCampaigns);
            setLoadingCampaigns(false);
            if (statusFilteredCampaigns.length > 0) {
              setSelectedCampaign(statusFilteredCampaigns[0].id);
            }
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
    
      const loadRecentPledges = async (page = 1) => {
        try {
          setLoadingRecentPledges(true);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
          const allRecords = await tables.pledges.select({ view: 'Grid view', filterByFormula: `IS_AFTER({PledgeDate}, "${cutoffDate}")` }).all();
          setTotalPledges(allRecords.length);
          const offset = (page - 1) * pledgesPerPage;
          const records = await tables.pledges.select({ view: 'Grid view', filterByFormula: `IS_AFTER({PledgeDate}, "${cutoffDate}")`, sort: [{ field: 'PledgeDate', direction: 'desc' }], maxRecords: pledgesPerPage, ...(offset > 0 && { offset }) }).all();
          let currentCampaigns = campaigns;
          let currentCampuses = campuses;
          if (campaigns.length === 0 || campuses.length === 0) {
            const [freshCampaigns, freshCampuses] = await Promise.all([fetchCampaigns(), fetchCampuses()]);
            currentCampaigns = freshCampaigns;
            currentCampuses = freshCampuses;
          }
          const pledgesData = records.map(record => {
            const donorId = record.get('Donor')?.[0];
            const campaignId = record.get('Campaign')?.[0];
            const campusId = record.get('PledgeCampus')?.[0];
            const donor = donorId ? { id: donorId, name: 'Loading...', email: '' } : null;
            const campaign = currentCampaigns.find(c => c.id === campaignId);
            const campus = currentCampuses.find(c => c.id === campusId);
            return { id: record.id, donorId, donor, campaign: campaign ? campaign.name : 'Unknown Campaign', campus: campus ? campus.name : 'Unknown Campus', amount: record.get('Amount') || 0, pledgeDate: record.get('PledgeDate') || '', notes: record.get('Notes') || '', pledgeType: record.get('PledgeType') || 'One-time', recurringFrequency: record.get('RecurringFrequency') || '', pledgeEndDate: record.get('PledgeEndDate') || '' };
          });
          const pledgesWithDonors = await Promise.all(pledgesData.map(async (pledge) => {
            if (pledge.donorId) {
              try {
                const donorRecord = await tables.people.find(pledge.donorId);
                return { ...pledge, donor: { id: pledge.donorId, name: donorRecord.get('Name') || 'Unknown', email: donorRecord.get('Email') || '' } };
              } catch (error) {
                console.error('Error fetching donor:', error);
                return pledge;
              }
            }
            return pledge;
          }));
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
    
      const refreshRecentPledges = async () => { await loadRecentPledges(pledgesCurrentPage); };
      const handlePledgesPageChange = (newPage) => { loadRecentPledges(newPage); };

  // UPDATED: This function now opens the confirmation modal
  const handleDeletePledge = (pledgeId) => {
    setOpenPledgeDropdown(null); // Close the ellipsis dropdown
    setPledgeToDelete(pledgeId); // Set which pledge to delete
    setShowDeleteModal(true); // Show the confirmation modal
  };

  // NEW: This function runs when the user confirms deletion in the modal
  const confirmDeletePledge = async () => {
    if (!pledgeToDelete) return;

    try {
      await tables.pledges.destroy([pledgeToDelete]);
      await refreshRecentPledges();
    } catch (error) {
      console.error('❌ Error deleting pledge:', error);
      alert('Error deleting pledge. Please try again.');
    } finally {
      // Close the modal and reset the state
      setShowDeleteModal(false);
      setPledgeToDelete(null);
    }
  };


  const searchMembers = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setMemberSearchResults([]);
      setShowMemberDropdown(false);
      return;
    }
    try {
      setIsSearchingMembers(true);
      const records = await tables.people.select({ view: 'Grid view', filterByFormula: `OR(SEARCH("${searchTerm.toLowerCase()}", LOWER({Name})), SEARCH("${searchTerm.toLowerCase()}", LOWER({Email})))`, maxRecords: 10, sort: [{ field: 'Name', direction: 'asc' }] }).all();
      const members = records.map(record => ({ id: record.id, name: record.get('Name') || 'Unknown', email: record.get('Email') || '', homeCampus: (() => { const homeCampusId = record.get('HomeCampus'); if (homeCampusId && homeCampusId.length > 0) { const campus = campuses.find(c => c.id === homeCampusId[0]); return campus ? campus.name : ''; } return ''; })() }));
      setMemberSearchResults(members);
      setShowMemberDropdown(true);
    } catch (error) {
      console.error('Error searching members:', error);
      setMemberSearchResults([]);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  const handleMemberInputChange = (value) => {
    setMemberName(value);
    setSelectedMember(null);
    clearTimeout(window.memberSearchTimeout);
    window.memberSearchTimeout = setTimeout(() => { searchMembers(value); }, 300);
  };

  const handleMemberSelect = (member) => {
    setSelectedMember(member);
    setMemberName(member.name);
    setShowMemberDropdown(false);
    setMemberSearchResults([]);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.member-search-container')) {
        setShowMemberDropdown(false);
      }
      if (!event.target.closest('.ellipsis-container')) {
        setOpenPledgeDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const createNewMember = async (memberData) => {
    try {
      setIsCreatingMember(true);
      const record = await tables.people.create([{ fields: { 'Name': memberData.name, 'Email': memberData.email } }]);
      return { id: record[0].id, name: record[0].fields['Name'], email: record[0].fields['Email'] || '', homeCampus: '' };
    } catch (error) {
      console.error('❌ Error creating member:', error);
      throw error;
    } finally {
      setIsCreatingMember(false);
    }
  };

  const handleAddNewMember = (suggestedName = '') => {
    setNewMemberData({ name: suggestedName, email: '' });
    setShowAddMemberModal(true);
    setShowMemberDropdown(false);
  };

  const handleNewMemberSubmit = async (e) => {
    e.preventDefault();
    if (!newMemberData.name.trim()) { alert('Please enter a name'); return; }
    try {
      const newMember = await createNewMember(newMemberData);
      handleMemberSelect(newMember);
      setShowAddMemberModal(false);
      setNewMemberData({ name: '', email: '' });
    } catch (error) {
      alert('Error creating member. Please try again.');
    }
  };

  const handleCloseModal = () => {
    setShowAddMemberModal(false);
    setNewMemberData({ name: '', email: '' });
  };
  
  const checkForExistingPledge = async (donorId, campaignId) => {
    try {
      const allRecords = await tables.pledges.select({ view: 'Grid view' }).all();
      const matchingPledges = allRecords.filter(record => {
        const recordDonor = record.get('Donor');
        const recordCampaign = record.get('Campaign');
        return recordDonor && recordDonor.includes(donorId) && recordCampaign && recordCampaign.includes(campaignId);
      });
      if (matchingPledges.length > 0) {
        const record = matchingPledges[0];
        return { id: record.id, amount: record.get('Amount') || 0, pledgeDate: record.get('PledgeDate') || '', notes: record.get('Notes') || '' };
      }
      return null;
    } catch (error) {
      console.error('Error checking for existing pledge:', error);
      throw error;
    }
  };

  const createPledge = async (pledgeData) => {
    try {
      const fields = { 'Donor': [pledgeData.donorId], 'PledgeCampus': [pledgeData.campusId], 'Campaign': [pledgeData.campaignId], 'Amount': pledgeData.amount, 'PledgeDate': pledgeData.pledgeDate, 'Notes': pledgeData.notes || '', 'PledgeType': pledgeData.pledgeType, };
      if (pledgeData.pledgeType === 'Recurring') {
        fields['RecurringFrequency'] = pledgeData.recurringFrequency;
        if (pledgeData.pledgeEndDate) {
          fields['PledgeEndDate'] = pledgeData.pledgeEndDate;
        }
      }
      const record = await tables.pledges.create([{ fields: fields }]);
      return record[0];
    } catch (error) {
      console.error('❌ Error creating pledge:', error);
      throw error;
    }
  };

  const updatePledge = async (pledgeId, pledgeData) => {
    try {
      const fields = { 'Amount': pledgeData.amount, 'PledgeDate': pledgeData.pledgeDate, 'PledgeCampus': [pledgeData.campusId], 'Notes': pledgeData.notes || '', 'PledgeType': pledgeData.pledgeType, };
      if (pledgeData.pledgeType === 'Recurring') {
        fields['RecurringFrequency'] = pledgeData.recurringFrequency;
        if (pledgeData.pledgeEndDate) {
          fields['PledgeEndDate'] = pledgeData.pledgeEndDate;
        }
      } else {
        fields['RecurringFrequency'] = null;
        fields['PledgeEndDate'] = null;
      }
      const record = await tables.pledges.update([{ id: pledgeId, fields: fields }]);
      return record[0];
    } catch (error) {
      console.error('❌ Error updating pledge:', error);
      throw error;
    }
  };

  const handleAddPledge = async () => {
    if (!selectedMember || !selectedCampaign || !selectedCampus || !pledgeAmount || !pledgeDate) { alert('Please fill in all required fields'); return; }
    if (pledgeType === 'Recurring' && (!recurringFrequency || !pledgeEndDate)) { alert('Please select a frequency and end date for recurring pledges'); return; }
    try {
      setIsCreatingPledge(true);
      const existing = await checkForExistingPledge(selectedMember.id, selectedCampaign);
      if (existing) {
        setExistingPledge(existing);
        setShowDuplicateModal(true);
        setIsCreatingPledge(false);
        return;
      }
      await createNewPledge();
    } catch (error) {
      console.error('Error processing pledge:', error);
      alert('Error processing pledge. Please try again.');
      setIsCreatingPledge(false);
    }
  };

  const createNewPledge = async () => {
    try {
      let finalAmount = pledgeType === 'Recurring' && totalAmount ? totalAmount : parseFloat(pledgeAmount.replace(/[$,]/g, ''));
      const pledgeData = { donorId: selectedMember.id, campusId: selectedCampus, campaignId: selectedCampaign, amount: finalAmount, pledgeDate: pledgeDate, notes: '', pledgeType: pledgeType, recurringFrequency: pledgeType === 'Recurring' ? recurringFrequency : null, pledgeEndDate: pledgeType === 'Recurring' && pledgeEndDate ? pledgeEndDate : null };
      await createPledge(pledgeData);
      alert('Pledge added successfully!');
      handleReset();
      await refreshRecentPledges();
    } catch (error) {
      console.error('Error creating pledge:', error);
      alert('Error creating pledge. Please try again.');
    } finally {
      setIsCreatingPledge(false);
    }
  };

  const handleUpdateExistingPledge = async () => {
    try {
      setIsUpdatingPledge(true);
      let finalAmount = pledgeType === 'Recurring' && totalAmount ? totalAmount : parseFloat(pledgeAmount.replace(/[$,]/g, ''));
      const pledgeData = { campusId: selectedCampus, amount: finalAmount, pledgeDate: pledgeDate, notes: '', pledgeType: pledgeType, recurringFrequency: pledgeType === 'Recurring' ? recurringFrequency : null, pledgeEndDate: pledgeType === 'Recurring' && pledgeEndDate ? pledgeEndDate : null };
      await updatePledge(existingPledge.id, pledgeData);
      alert('Pledge updated successfully!');
      setShowDuplicateModal(false);
      setExistingPledge(null);
      handleReset();
      await refreshRecentPledges();
    } catch (error) {
      console.error('Error updating pledge:', error);
      alert('Error updating pledge. Please try again.');
    } finally {
      setIsUpdatingPledge(false);
    }
  };
  
  const handleCloseDuplicateModal = () => {
    setShowDuplicateModal(false);
    setExistingPledge(null);
    setIsCreatingPledge(false);
  };


  const getAvailableCampuses = () => {
    if (!selectedCampaign) return [];
    const campaign = campaigns.find(c => c.id === selectedCampaign);
    if (!campaign) return [];
    if (campaign.assignedCampuses && campaign.assignedCampuses.length > 0) {
      return campuses.filter(campus => campaign.assignedCampuses.includes(campus.id));
    }
    return campuses;
  };
  const availableCampuses = getAvailableCampuses();

  const handleCampaignChange = (campaignId) => {
    setSelectedCampaign(campaignId);
    setSelectedCampus('');
  };
  const breadcrumbs = [{ text: 'Campaigns', link: '/org-admin' }, { text: 'Add a pledge' }];
  const handleReset = () => {
    setMemberName('');
    setSelectedMember(null);
    setSelectedCampus('');
    setPledgeAmount('');
    setPledgeDate(new Date().toISOString().split('T')[0]);
    setPledgeType('One-time');
    setRecurringFrequency('');
    setPledgeEndDate('');
    setMemberSearchResults([]);
    setShowMemberDropdown(false);
    if (campaigns.length > 0) {
      setSelectedCampaign(campaigns[0].id);
    }
  };

  const formatCurrency = (value) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers === '') return '';
    const amount = parseInt(numbers);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const handlePledgeAmountChange = (e) => {
    const formatted = formatCurrency(e.target.value);
    setPledgeAmount(formatted);
  };

  const filteredPledges = recentPledges.filter(pledge =>
    pledge.donor?.name.toLowerCase().includes(pledgeSearchQuery.toLowerCase())
  );

  return (
    <Layout breadcrumbs={breadcrumbs} userRole={userRole} userCampuses={userCampuses}>
      <div className="add-pledge-container">
        <div className="add-pledge-header">
          <h1>Add a pledge</h1>
        </div>
        <div className="pledge-form-container">
        {/* ... (Form JSX remains the same) ... */}
        <div className="form-group">
            <label className="form-label">Choose your Campaign</label>
            <div className="select-wrapper">
              <select className="campaign-select" value={selectedCampaign} onChange={(e) => handleCampaignChange(e.target.value)} disabled={loadingCampaigns}>
                {loadingCampaigns ? (<option>Loading campaigns...</option>) : campaigns.length === 0 ? (<option>No available campaigns</option>) : (campaigns.map(campaign => (<option key={campaign.id} value={campaign.id}>{campaign.name}</option>)))}
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Campus</label>
            <div className="select-wrapper">
              <select className="campus-select" value={selectedCampus} onChange={(e) => setSelectedCampus(e.target.value)} disabled={!selectedCampaign || availableCampuses.length === 0 || loadingCampuses}>
                <option value="">{loadingCampuses ? 'Loading campuses...' : 'Select a campus'}</option>
                {availableCampuses.map(campus => (<option key={campus.id} value={campus.id}>{campus.name}</option>))}
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Member's details</label>
            <div className="member-search-container">
              <input type="text" className="member-input" placeholder="Type member's name or email" value={memberName} onChange={(e) => handleMemberInputChange(e.target.value)} onFocus={() => memberSearchResults.length > 0 && setShowMemberDropdown(true)} />
              {isSearchingMembers && (<div className="search-loading"><span className="loading-spinner">⟳</span>Searching...</div>)}
              {showMemberDropdown && (
                <div className="member-dropdown">
                  {memberSearchResults.length > 0 ? (memberSearchResults.map((member) => (
                    <div key={member.id} className="member-option" onClick={() => handleMemberSelect(member)}>
                      <div className="member-option-main"><span className="member-option-name">{member.name}</span>{member.email && (<span className="member-option-email">{member.email}</span>)}</div>
                      {member.homeCampus && (<span className="member-option-campus">{member.homeCampus}</span>)}
                    </div>))) : memberName.length >= 2 ? (
                    <div className="no-members-found">
                      <div className="no-members-text">No members found for "{memberName}"</div>
                      <button className="add-new-member-suggestion" onClick={() => handleAddNewMember(memberName)}><span className="add-icon">+</span>Add "{memberName}" as a new member</button>
                    </div>) : null}
                </div>
              )}
              {selectedMember && (<div className="selected-member-info"><span className="selected-member-icon">✓</span><span className="selected-member-text">Selected: {selectedMember.name}{selectedMember.email && ` (${selectedMember.email})`}</span></div>)}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Giving frequency</label>
            <div className="giving-frequency-container">
              <div className="pledge-type-options">
                <div className="radio-group">
                  <label className="radio-option"><input type="radio" name="pledgeType" value="One-time" checked={pledgeType === 'One-time'} onChange={(e) => handlePledgeTypeChange(e.target.value)} /><span className="radio-label">One time</span></label>
                  <label className="radio-option"><input type="radio" name="pledgeType" value="Recurring" checked={pledgeType === 'Recurring'} onChange={(e) => handlePledgeTypeChange(e.target.value)} /><span className="radio-label">Recurring</span></label>
                </div>
              </div>
              {pledgeType === 'Recurring' && (
                <div className="recurring-frequency-inline">
                  <div className="select-wrapper">
                    <select className="recurring-frequency-select" value={recurringFrequency} onChange={(e) => setRecurringFrequency(e.target.value)}>
                      <option value="">Select frequency</option><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Annually">Annually</option>
                    </select>
                    <span className="select-arrow">▼</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Pledge Amount</label>
            <div className="pledge-amount-container">
              <input type="text" className="pledge-amount-input" placeholder="$0" value={pledgeAmount} onChange={handlePledgeAmountChange} />
              {pledgeType === 'Recurring' && totalAmount && (<div className="total-amount-display">(${totalAmount.toLocaleString()} total)</div>)}
            </div>
          </div>
          <div className="form-group">
            <div className="pledge-date-container">
              <div className="pledge-date-section"><label className="inline-label">Pledge Date</label><input type="date" className="pledge-date-input" value={pledgeDate} onChange={(e) => setPledgeDate(e.target.value)} /></div>
              {pledgeType === 'Recurring' && (<div className="end-date-inline"><label className="inline-label">End date</label><input type="date" className="pledge-end-date-input" value={pledgeEndDate} onChange={(e) => setPledgeEndDate(e.target.value)} min={pledgeDate} /></div>)}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-reset" onClick={handleReset}>Reset</button>
            <button className={`btn-add-pledge ${(memberName.trim() || selectedMember) && selectedCampaign && selectedCampus && pledgeAmount && pledgeDate && (pledgeType === 'One-time' || (recurringFrequency && pledgeEndDate)) ? 'enabled' : 'disabled'}`} disabled={!(memberName.trim() || selectedMember) || !selectedCampaign || !selectedCampus || !pledgeAmount || !pledgeDate || (pledgeType === 'Recurring' && (!recurringFrequency || !pledgeEndDate)) || isCreatingPledge} onClick={handleAddPledge}>
              {isCreatingPledge ? (<><span className="loading-spinner">⟳</span>Processing...</>) : ('Add pledge')}
            </button>
          </div>
        </div>

        {showRecentPledges && (
          <div className="recent-pledges-section">
            <div className="recent-pledges-header">
              <h2 className="recent-pledges-title">Recent pledges (Last 30 days)</h2>
              <div className="pledges-count">{totalPledges > 0 && (<span className="count-text">Showing {((pledgesCurrentPage - 1) * pledgesPerPage) + 1}-{Math.min(pledgesCurrentPage * pledgesPerPage, totalPledges)} of {totalPledges} pledges</span>)}</div>
            </div>
            <div className="pledge-search-container">
              <input type="text" className="pledge-search-input" placeholder="Search recent pledges by name..." value={pledgeSearchQuery} onChange={(e) => setPledgeSearchQuery(e.target.value)} />
            </div>
            {loadingRecentPledges ? (<div className="loading-state"><span className="loading-spinner">⟳</span>Loading recent pledges...</div>) : (
              <>
                <div className="pledges-table-container">
                  <table className="pledges-table">
                    <thead><tr><th>Name</th><th>Email address</th><th>Date pledged</th><th>Campaign name</th><th>Campus</th><th>Type</th><th>Total pledged</th><th></th></tr></thead>
                    <tbody>
                      {filteredPledges.length === 0 ? (<tr><td colSpan="8" className="no-pledges-message">{pledgeSearchQuery ? `No pledges found matching "${pledgeSearchQuery}"` : "No pledges found in the last 30 days"}</td></tr>) : (
                        filteredPledges.map((pledge) => (
                          <tr key={pledge.id}>
                            <td className="name-cell">{pledge.donor?.name || 'Unknown'}</td>
                            <td className="email-cell">{pledge.donor?.email || ''}</td>
                            <td>{pledge.pledgeDate ? new Date(pledge.pledgeDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</td>
                            <td className="campaign-cell">{pledge.campaign}</td>
                            <td className="campus-cell">{pledge.campus}</td>
                            <td className="type-cell"><span className={`pledge-type-badge ${pledge.pledgeType?.toLowerCase()}`}>{pledge.pledgeType === 'Recurring' ? `${pledge.pledgeType} (${pledge.recurringFrequency || 'Unknown'})` : (pledge.pledgeType || 'One-time')}</span></td>
                            <td className="amount-cell">${typeof pledge.amount === 'number' ? pledge.amount.toFixed(2) : '0.00'}</td>
                            <td className="pledge-actions-cell">
                                <div className="ellipsis-container">
                                    <button className="ellipsis-btn" onClick={() => setOpenPledgeDropdown(openPledgeDropdown === pledge.id ? null : pledge.id)}>
                                    ⋯
                                    </button>
                                    {openPledgeDropdown === pledge.id && (
                                    <div className="pledge-dropdown-menu">
                                       <div className="pledge-dropdown-item" onClick={() => navigate(`/edit-pledge/${pledge.id}`)}>
                                            <span className="dropdown-icon">✏️</span> Edit pledge
                                      </div>
                                        {/* UPDATED: This now opens the delete modal */}
                                        <div className="pledge-dropdown-item" onClick={() => handleDeletePledge(pledge.id)}>
                                        <span className="dropdown-icon">🗑️</span> Delete
                                        </div>
                                    </div>
                                    )}
                                </div>
                            </td>
                          </tr>
                        )))}
                    </tbody>
                  </table>
                </div>
                {totalPledges > pledgesPerPage && !pledgeSearchQuery && (
                  <div className="pledges-pagination">
                    <button className="pagination-arrow" disabled={pledgesCurrentPage === 1} onClick={() => handlePledgesPageChange(pledgesCurrentPage - 1)}>❮ Previous</button>
                    <div className="pagination-info">Page {pledgesCurrentPage} of {Math.ceil(totalPledges / pledgesPerPage)}</div>
                    <button className="pagination-arrow" disabled={pledgesCurrentPage >= Math.ceil(totalPledges / pledgesPerPage)} onClick={() => handlePledgesPageChange(pledgesCurrentPage + 1)}>Next ❯</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ... (Add Member and Duplicate Pledge Modals remain the same) ... */}
      {showAddMemberModal && ( <div className="modal-overlay" onClick={handleCloseModal}><div className="modal-content" onClick={(e) => e.stopPropagation()}><div className="modal-header"><h2 className="modal-title">Add New Member</h2><button className="modal-close" onClick={handleCloseModal}>×</button></div><form onSubmit={handleNewMemberSubmit} className="modal-form"><div className="modal-field"><label className="modal-label">Name <span className="required-asterisk">*</span></label><input type="text" className="modal-input" value={newMemberData.name} onChange={(e) => setNewMemberData(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter member's name" required autoFocus /></div><div className="modal-field"><label className="modal-label">Email</label><input type="email" className="modal-input" value={newMemberData.email} onChange={(e) => setNewMemberData(prev => ({ ...prev, email: e.target.value }))} placeholder="Enter member's email (optional)" /></div><div className="modal-actions"><button type="button" className="modal-btn-cancel" onClick={handleCloseModal} disabled={isCreatingMember}>Cancel</button><button type="submit" className="modal-btn-submit" disabled={!newMemberData.name.trim() || isCreatingMember}>{isCreatingMember ? (<><span className="loading-spinner">⟳</span>Creating...</>) : ('Add Member')}</button></div></form></div></div> )}
      {showDuplicateModal && existingPledge && ( <div className="modal-overlay" onClick={handleCloseDuplicateModal}><div className="modal-content duplicate-modal" onClick={(e) => e.stopPropagation()}><div className="modal-header"><h2 className="modal-title">Pledge Already Exists</h2><button className="modal-close" onClick={handleCloseDuplicateModal}>×</button></div><div className="modal-body"><div className="duplicate-warning"><div className="warning-icon">⚠️</div><div className="warning-text"><p><strong>{selectedMember?.name}</strong> already has a pledge for this campaign.</p></div></div><div className="pledge-comparison"><div className="existing-pledge"><h4>Current Pledge:</h4><div className="pledge-details"><span className="amount">${existingPledge.amount.toFixed(2)}</span><span className="date">{new Date(existingPledge.pledgeDate).toLocaleDateString()}</span></div></div><div className="new-pledge"><h4>New Amount:</h4><div className="pledge-details"><span className="amount">{pledgeType === 'Recurring' && totalAmount ? `${totalAmount.toLocaleString()}` : pledgeAmount}</span><span className="date">{new Date(pledgeDate).toLocaleDateString()}</span></div></div></div><p className="update-explanation">Would you like to update their existing pledge with the new amount and date?</p></div><div className="modal-actions"><button type="button" className="modal-btn-cancel" onClick={handleCloseDuplicateModal} disabled={isUpdatingPledge}>Cancel</button><button type="button" className="modal-btn-submit" onClick={handleUpdateExistingPledge} disabled={isUpdatingPledge}>{isUpdatingPledge ? (<><span className="loading-spinner">⟳</span>Updating...</>) : ('Update Pledge')}</button></div></div></div> )}

      {/* NEW: Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Delete Pledge</h2>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{padding: '24px'}}>
              <p>Are you sure you want to delete this pledge? This action cannot be undone.</p>
            </div>
            <div className="modal-actions" style={{padding: '0 24px 24px'}}>
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn-delete" /* New class for styling */
                onClick={confirmDeletePledge}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default AddPledge;