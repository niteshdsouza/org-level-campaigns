import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import './EditPledge.css'; // Import the new CSS file
import { fetchCampaigns, fetchCampuses, tables } from './airtable';

function EditPledge({ userRole, userCampuses }) {
  const { pledgeId } = useParams(); // Get pledgeId from URL (e.g., /edit-pledge/recXXXX)
  const navigate = useNavigate();

  // State for loading indicators
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // State for the new modal

  // Form input states
  const [campaigns, setCampaigns] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('');
  const [memberName, setMemberName] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [pledgeAmount, setPledgeAmount] = useState(''); // This will be the per-period amount for recurring
  const [pledgeDate, setPledgeDate] = useState('');
  const [pledgeType, setPledgeType] = useState('One-time');
  const [recurringFrequency, setRecurringFrequency] = useState('');
  const [pledgeEndDate, setPledgeEndDate] = useState('');

  // Member search states (same as AddPledge)
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);

  // --- Utility Functions ---

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    const numbers = stringValue.replace(/[^\d.]/g, ''); // Allow decimal points
    if (numbers === '') return '';
    
    const amount = parseFloat(numbers);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2, // Show cents for currency
      maximumFractionDigits: 2,
    }).format(amount);
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Adjust for timezone offset to show correct local date
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
  };

  // --- Data Fetching and Initialization ---

  useEffect(() => {
    const loadInitialData = async () => {
      if (!pledgeId) {
        console.error("No pledge ID provided.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [campaignData, campusData, pledgeRecord] = await Promise.all([
          fetchCampaigns(),
          fetchCampuses(),
          tables.pledges.find(pledgeId),
        ]);

        setCampaigns(campaignData);
        setCampuses(campusData);

        const pledge = pledgeRecord.fields;
        setSelectedCampaign(pledge.Campaign?.[0] || '');
        setSelectedCampus(pledge.PledgeCampus?.[0] || '');
        setPledgeDate(pledge.PledgeDate || '');
        setPledgeType(pledge.PledgeType || 'One-time');
        setRecurringFrequency(pledge.RecurringFrequency || '');
        setPledgeEndDate(pledge.PledgeEndDate || '');

        if (pledge.PledgeType === 'Recurring') {
            const periods = calculatePeriods(pledge.PledgeDate, pledge.PledgeEndDate, pledge.RecurringFrequency);
            const perPeriodAmount = periods > 0 ? (pledge.Amount || 0) / periods : 0;
            setPledgeAmount(formatCurrency(perPeriodAmount).replace(/[$,]/g, ''));
        } else {
            setPledgeAmount(formatCurrency(pledge.Amount).replace(/[$,]/g, ''));
        }

        if (pledge.Donor && pledge.Donor.length > 0) {
          const donorRecord = await tables.people.find(pledge.Donor[0]);
          const donor = {
            id: donorRecord.id,
            name: donorRecord.fields.Name || 'Unknown',
            email: donorRecord.fields.Email || '',
          };
          setSelectedMember(donor);
          setMemberName(donor.name);
        }

      } catch (error) {
        console.error("Failed to load pledge data:", error);
        alert("Could not load pledge details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [pledgeId]);


  // --- Member Search Logic ---
  const searchMembers = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setMemberSearchResults([]);
      setShowMemberDropdown(false);
      return;
    }
    setIsSearchingMembers(true);
    try {
      const records = await tables.people.select({
        filterByFormula: `OR(SEARCH("${searchTerm.toLowerCase()}", LOWER({Name})), SEARCH("${searchTerm.toLowerCase()}", LOWER({Email})))`,
        maxRecords: 10
      }).all();
      const members = records.map(record => ({ id: record.id, name: record.get('Name'), email: record.get('Email') }));
      setMemberSearchResults(members);
      setShowMemberDropdown(true);
    } catch (error) {
      console.error('Error searching members:', error);
    } finally {
      setIsSearchingMembers(false);
    }
  }, []);
  
  const handleMemberInputChange = (value) => {
    setMemberName(value);
    setSelectedMember(null);
    clearTimeout(window.memberSearchTimeout);
    window.memberSearchTimeout = setTimeout(() => {
        searchMembers(value);
    }, 300);
  };

  const handleMemberSelect = (member) => {
    setSelectedMember(member);
    setMemberName(member.name);
    setShowMemberDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.member-search-container')) {
        setShowMemberDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);


  // --- Recurring Pledge Calculation ---
  const calculatePeriods = (startDate, endDate, frequency) => {
    if (!startDate || !endDate || !frequency) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;

    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    months += 1; 

    switch (frequency) {
      case 'Monthly':
        return months;
      case 'Quarterly':
        return Math.floor(months / 3);
      case 'Annually':
        return Math.floor(months / 12);
      default:
        return 0;
    }
  };

  const perPeriodAmount = parseFloat(pledgeAmount.replace(/[$,]/g, '')) || 0;
  const periods = calculatePeriods(pledgeDate, pledgeEndDate, recurringFrequency);
  const totalCalculatedAmount = perPeriodAmount * periods;

  // --- Form Submission ---
  const handleOpenConfirmModal = () => {
     if (!selectedMember || !selectedCampaign || !selectedCampus || !pledgeAmount || !pledgeDate) {
      alert('Please fill in all required fields.');
      return;
    }
    if (pledgeType === 'Recurring' && (!recurringFrequency || !pledgeEndDate)) {
      alert('Please select a frequency and end date for recurring pledges.');
      return;
    }
    setShowConfirmModal(true);
  }

  const handleUpdatePledge = async () => {
    setIsUpdating(true);
    try {
      const finalAmount = pledgeType === 'Recurring' ? totalCalculatedAmount : perPeriodAmount;
      
      const fieldsToUpdate = {
        'Donor': [selectedMember.id],
        'Campaign': [selectedCampaign],
        'PledgeCampus': [selectedCampus],
        'Amount': finalAmount,
        'PledgeDate': pledgeDate,
        'PledgeType': pledgeType,
        'RecurringFrequency': pledgeType === 'Recurring' ? recurringFrequency : null,
        'PledgeEndDate': pledgeType === 'Recurring' ? pledgeEndDate : null,
      };

      await tables.pledges.update([{ id: pledgeId, fields: fieldsToUpdate }]);
      
      setShowConfirmModal(false);
      alert('Pledge updated successfully!');
      navigate('/add-pledge'); // Navigate back to the pledges list
    } catch (error) {
      console.error("Error updating pledge:", error);
      alert("Failed to update pledge. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Render Logic ---
  if (loading) {
    return <Layout><div style={{ padding: '40px', textAlign: 'center' }}>Loading pledge details...</div></Layout>;
  }

  const getCampaignName = () => campaigns.find(c => c.id === selectedCampaign)?.name || 'N/A';
  const getCampusName = () => campuses.find(c => c.id === selectedCampus)?.name || 'N/A';
  const availableCampuses = campaigns.find(c => c.id === selectedCampaign)?.assignedCampuses || [];
  const filteredCampuses = campuses.filter(c => availableCampuses.includes(c.id));

  return (
    <Layout userRole={userRole} userCampuses={userCampuses}>
      <div className="add-pledge-container">
        <div className="add-pledge-header">
          <h1>Edit Pledge</h1>
        </div>

        <div className="pledge-form-container">
          {/* Form fields are unchanged... */}
          <div className="form-group">
            <label className="form-label">Choose your Campaign</label>
            <div className="select-wrapper">
              <select className="campaign-select" value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Campus</label>
            <div className="select-wrapper">
              <select className="campus-select" value={selectedCampus} onChange={(e) => setSelectedCampus(e.target.value)} disabled={!selectedCampaign}>
                <option value="">Select a campus</option>
                {filteredCampuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Member's details</label>
            <div className="member-search-container">
              <input type="text" className="member-input" placeholder="Type member's name or email" value={memberName} onChange={(e) => handleMemberInputChange(e.target.value)} />
               {showMemberDropdown && (
                <div className="member-dropdown">
                  {isSearchingMembers ? <div className="search-loading">Searching...</div> : 
                    memberSearchResults.length > 0 ? memberSearchResults.map((member) => (
                      <div key={member.id} className="member-option" onClick={() => handleMemberSelect(member)}>
                        <div className="member-option-main">
                          <span className="member-option-name">{member.name}</span>
                          {member.email && <span className="member-option-email">{member.email}</span>}
                        </div>
                      </div>
                    )) : <div className="no-members-found">No members found.</div>
                  }
                </div>
              )}
               {selectedMember && (<div className="selected-member-info"><span className="selected-member-icon">✓</span><span className="selected-member-text">Selected: {selectedMember.name}</span></div>)}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Giving frequency</label>
            <div className="giving-frequency-container">
              <div className="pledge-type-options">
                <div className="radio-group">
                  <label className="radio-option">
                    <input type="radio" name="pledgeType" value="One-time" checked={pledgeType === 'One-time'} onChange={(e) => setPledgeType(e.target.value)} />
                    <span className="radio-label">One time</span>
                  </label>
                  <label className="radio-option">
                    <input type="radio" name="pledgeType" value="Recurring" checked={pledgeType === 'Recurring'} onChange={(e) => setPledgeType(e.target.value)} />
                    <span className="radio-label">Recurring</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          {pledgeType === 'Recurring' && (
             <div className="form-group">
                <label className="form-label">Frequency</label>
                <div className="select-wrapper">
                    <select className="recurring-frequency-select" value={recurringFrequency} onChange={(e) => setRecurringFrequency(e.target.value)}>
                        <option value="">Select frequency</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Annually">Annually</option>
                    </select>
                    <span className="select-arrow">▼</span>
                </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{pledgeType === 'Recurring' ? 'Amount per Period' : 'Pledge Amount'}</label>
            <input
              type="text"
              className="pledge-amount-input"
              placeholder="$0.00"
              value={pledgeAmount}
              onChange={(e) => setPledgeAmount(e.target.value)}
            />
            {pledgeType === 'Recurring' && pledgeAmount && pledgeDate && pledgeEndDate && recurringFrequency && (
              <div className="recurring-calculation-breakdown">
                <span className="calculation-text">
                  {formatCurrency(perPeriodAmount)} x {periods} {recurringFrequency.toLowerCase()} payments ={' '}
                </span>
                <span className="total-amount">
                  {formatCurrency(totalCalculatedAmount)} total
                </span>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Pledge Date</label>
            <input type="date" className="pledge-date-input" value={pledgeDate} onChange={e => setPledgeDate(e.target.value)} />
          </div>
          {pledgeType === 'Recurring' && (
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input type="date" className="pledge-end-date-input" value={pledgeEndDate} onChange={e => setPledgeEndDate(e.target.value)} min={pledgeDate} />
              </div>
          )}
          <div className="form-actions">
            <button className="btn-reset" type="button" onClick={() => navigate('/add-pledge')}>Cancel</button>
            <button className="btn-add-pledge enabled" onClick={handleOpenConfirmModal} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Pledge'}
            </button>
          </div>
        </div>
      </div>

      {/* --- Confirmation Modal --- */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Update pledge</h2>
              <button className="modal-close" onClick={() => setShowConfirmModal(false)} disabled={isUpdating}>×</button>
            </div>
            <div className="confirm-modal-body">
              <div className="confirm-modal-icon">!</div>
              <p className="confirm-modal-question">Are you sure you want to update this pledge?</p>
              <ul className="pledge-summary-list">
                <li className="summary-item">
                  <span className="summary-label">Member name</span>
                  <span className="summary-value">{selectedMember?.name || 'N/A'}</span>
                </li>
                <li className="summary-item">
                  <span className="summary-label">Campaign</span>
                  <span className="summary-value">{getCampaignName()}</span>
                </li>
                 <li className="summary-item">
                  <span className="summary-label">Campus</span>
                  <span className="summary-value">{getCampusName()}</span>
                </li>
                <li className="summary-item">
                  <span className="summary-label">Total pledged</span>
                  <span className="summary-value">{formatCurrency(pledgeType === 'Recurring' ? totalCalculatedAmount : perPeriodAmount)}</span>
                </li>
                {pledgeType === 'Recurring' && (
                  <>
                    <li className="summary-item">
                        <span className="summary-label">Giving frequency</span>
                        <span className="summary-value highlight">{recurringFrequency}</span>
                    </li>
                    <li className="summary-item">
                        <span className="summary-label">Start date</span>
                        <span className="summary-value highlight">{formatDate(pledgeDate)}</span>
                    </li>
                    <li className="summary-item">
                        <span className="summary-label">End date</span>
                        <span className="summary-value highlight">{formatDate(pledgeEndDate)}</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-btn-cancel" onClick={() => setShowConfirmModal(false)} disabled={isUpdating}>
                Cancel
              </button>
              <button type="button" className="modal-btn-submit" onClick={handleUpdatePledge} disabled={isUpdating}>
                {isUpdating ? 'Updating...' : 'Yes, update this pledge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default EditPledge;
