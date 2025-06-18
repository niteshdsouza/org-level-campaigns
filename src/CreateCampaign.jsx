import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { fetchCampuses, fetchListings, fetchOrgFundListings, createFund, createCampaign, createCampusGoals } from './airtable';

function CreateCampaign() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    campaignName: '',
    description: '',
    financialGoal: '',
    startDate: '',
    endDate: '',
    phoneNumber: '',
    emailAddress: ''
  });
  const [fundData, setFundData] = useState({
    fundName: '',
    fundCode: '',
    taxDeductible: true,
    thankYouMessage: '',
    thankYouAnimation: 'none'
  });
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  const [allListings, setAllListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orgFundListings, setOrgFundListings] = useState([]);


  // Campus assignment state
  const [donationDestination, setDonationDestination] = useState('');
  const [orgFundListing, setOrgFundListing] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [campuses, setCampuses] = useState([]);

  // NEW: State to manage goals and split option
  const [campusGoals, setCampusGoals] = useState({});
  const [splitGoal, setSplitGoal] = useState(false);


  const filteredCampuses = campuses.filter(campus =>
    campus.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const itemsPerPage = 8;
  const totalPages = Math.ceil(filteredCampuses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCampuses = filteredCampuses.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingCampuses(true);
        const [campusesData, listingsData, orgFundListingsData] = await Promise.all([
          fetchCampuses(),
          fetchListings(),
          fetchOrgFundListings()
        ]);
        
        const campusesWithListings = campusesData.map(campus => ({
          ...campus,
          availableListings: listingsData.filter(listing => 
            listing.campusIds.includes(campus.id)
          )
        }));
        
        setCampuses(campusesWithListings);
        setAllListings(listingsData);
        setOrgFundListings(orgFundListingsData);
        
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoadingCampuses(false);
      }
    };
    
    loadData();
  }, []);

  // NEW: Effect to dynamically update the total goal from campus goals
  useEffect(() => {
    // This logic runs when campus goals change, but not when "split" is active
    // to prevent calculation loops.
    if (splitGoal) return;

    const totalFromCampuses = Object.values(campusGoals).reduce((sum, goal) => {
        const value = parseFloat(String(goal).replace(/[$,]/g, '')) || 0;
        return sum + value;
    }, 0);
    
    // Only update if the total is different, to avoid unnecessary re-renders
    const currentTotal = parseFloat(formData.financialGoal.replace(/[$,]/g, '')) || 0;
    if(totalFromCampuses !== currentTotal) {
        setFormData(prev => ({
            ...prev,
            financialGoal: formatCurrency(totalFromCampuses.toString())
        }));
    }
  }, [campusGoals, splitGoal]);


  const mandatoryFieldsFilled = 
    formData.campaignName.trim() !== '' && 
    formData.description.trim() !== '';

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (value) => {
    const numbers = String(value).replace(/[^\d.]/g, '');
    if (numbers === '') return '';
    const amount = parseFloat(numbers);
    if (isNaN(amount)) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  const handleCampusGoalChange = (campusId, value) => {
      const numbers = String(value).replace(/[^\d.]/g, '');
      setCampusGoals(prev => ({ ...prev, [campusId]: numbers }));
      setSplitGoal(false);
  };
  
  useEffect(() => {
    if (splitGoal) {
      const selectedCampuses = campuses.filter(c => c.selected);
      const totalGoal = parseFloat(formData.financialGoal.replace(/[$,]/g, '')) || 0;
      if (selectedCampuses.length > 0 && totalGoal > 0) {
        const splitAmount = totalGoal / selectedCampuses.length;
        const newGoals = {};
        campuses.forEach(campus => {
          if (campus.selected) {
            newGoals[campus.id] = splitAmount.toFixed(2);
          } else {
            newGoals[campus.id] = '';
          }
        });
        setCampusGoals(newGoals);
      }
    }
  }, [splitGoal, campuses, formData.financialGoal]);

  const handleCampusToggle = (campusId) => {
    setCampuses(prev => prev.map(campus => 
      campus.id === campusId 
        ? { ...campus, selected: !campus.selected, selectedListings: !campus.selected ? campus.selectedListings : [], showDropdown: false }
        : campus
    ));
    if (campuses.find(c => c.id === campusId)?.selected) {
        handleCampusGoalChange(campusId, '');
    }
  };

  const handleListingToggle = (campusId, listingValue, isChecked) => {
    setCampuses(prev => prev.map(campus => 
      campus.id === campusId 
        ? { ...campus, selectedListings: isChecked ? [...(campus.selectedListings || []), listingValue] : (campus.selectedListings || []).filter(item => item !== listingValue) }
        : campus
    ));
  };

  const handleDropdownToggle = (campusId) => {
    setCampuses(prev => prev.map(campus => 
      campus.id === campusId 
        ? { ...campus, showDropdown: !campus.showDropdown }
        : { ...campus, showDropdown: false }
    ));
  };

  const handleFinancialGoalChange = (e) => {
    const formatted = formatCurrency(e.target.value);
    handleInputChange('financialGoal', formatted);
    // If user edits total goal, uncheck the split option
    setSplitGoal(false);
  };

  const handleGoToFundStep = () => {
    setCurrentStep(3);
  };

  const handlePublishCampaign = async () => {
    setLoading(true);
    try {
        // 1. Create the Fund
        console.log("Step 1: Creating fund...");
        const newFund = await createFund(fundData);
        if (!newFund?.id) throw new Error("Fund creation failed.");
        console.log("Fund created:", newFund.id);

        // 2. Prepare data and Create the Campaign
        console.log("Step 2: Creating campaign...");
        const selectedCampusIds = campuses.filter(c => c.selected).map(c => c.id);
        const campaignPayload = {
            ...formData,
            donationDestination,
            orgFundListing,
        };
        const newCampaign = await createCampaign(campaignPayload, newFund.id, selectedCampusIds);
        if (!newCampaign?.id) throw new Error("Campaign creation failed.");
        console.log("Campaign created:", newCampaign.id);

        // 3. Create the Campus Goals
        console.log("Step 3: Creating campus goals...");
        await createCampusGoals(newCampaign.id, campusGoals);
        console.log("Campus goals created.");

        // 4. Success! Navigate to dashboard
        setLoading(false);
        navigate('/org-admin'); 

    } catch (error) {
        setLoading(false);
        console.error("Failed to publish campaign:", error);
        alert("An error occurred while publishing the campaign. Please check the console for details and try again.");
    }
  };

  // VALIDATION LOGIC FOR STEP 2
  const isGoalValid = (parseFloat(formData.financialGoal.replace(/[$,]/g, '')) || 0) > 0;
  const isDestinationValid = 
    (donationDestination === 'fund' && orgFundListing.trim() !== '') || 
    donationDestination === 'campus';
  const isStep2Valid = isGoalValid && isDestinationValid;

  return (
    <div className="app-layout">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-collapse">
              <span className="collapse-icon">←</span>
              Collapse Menu
            </div>
          </div>
          
          <div className="logo">
            <div className="logo-icon">🏛️</div>
            <span className="org-name">Central Church</span>
            <span className="dropdown-arrow">▼</span>
          </div>
  
          <div className="sidebar-menu">
            <div className="menu-item"><span className="menu-icon">📊</span>Dashboard</div>
            <div className="menu-item-container">
              <div className="menu-item"><span className="menu-icon">💰</span>Finance<span className="expand-arrow">▼</span></div>
              <div className="submenu">
                <div className="submenu-item">Reconciliation</div>
                <div className="submenu-item">Funds</div>
              </div>
            </div>
            <div className="menu-item-container">
              <div className="menu-item active"><span className="menu-icon">🏆</span>Campaigns<span className="expand-arrow">▼</span></div>
              <div className="submenu">
                <div className="submenu-item active">Overview<span className="checkmark">✓</span></div>
                <div className="submenu-item">Add a pledge</div>
              </div>
            </div>
            <div className="menu-item"><span className="menu-icon">👥</span>Community</div>
            <div className="menu-item"><span className="menu-icon">📈</span>App Analytics</div>
            <div className="menu-item"><span className="menu-icon">🌱</span>Donor Development</div>
            <div className="menu-item"><span className="menu-icon">🔄</span>Recurring</div>
            <div className="menu-item"><span className="menu-icon">🎁</span>Gift Entry</div>
            <div className="menu-item"><span className="menu-icon">📄</span>Giving Statements</div>
            <div className="menu-item"><span className="menu-icon">📚</span>Resource Center</div>
            <div className="menu-item"><span className="menu-icon">⚙️</span>Settings</div>
            <div className="menu-item"><span className="menu-icon">💬</span>Feedback</div>
          </div>
        </div>
  
        <div className="main-content">
          <div className="breadcrumb">
            <div className="breadcrumb-left">
              <span className="breadcrumb-link">Campaigns</span>
              <span className="breadcrumb-separator">›</span>
              <span>Overview</span>
            </div>
          </div>
  
          <div className="dashboard">
            <div className="dashboard-header">
              <h1>Create campaign</h1>
            </div>
            
            <div className="create-campaign-progress">
              <div className="progress-step"><div className={`step-circle ${currentStep >= 1 ? 'active' : ''}`}>{currentStep > 1 ? '✓' : '1'}</div><span className="step-label">Campaign details</span></div>
              <div className="progress-step"><div className={`step-circle ${currentStep >= 2 ? 'active' : ''}`}>{currentStep > 2 ? '✓' : '2'}</div><span className="step-label">Assign campuses</span></div>
              <div className="progress-step"><div className={`step-circle ${currentStep >= 3 ? 'active' : ''}`}>{currentStep > 3 ? '✓' : '3'}</div><span className="step-label">Create fund</span></div>
            </div>
  
            {currentStep === 1 && (
              <div className="campaign-form">
                <h2 className="form-section-title">Campaign Details</h2>
                <div className="form-field">
                  <label className="field-label">Campaign name <span className="required-asterisk">*</span></label>
                  <input type="text" className="field-input" placeholder="Enter campaign name" value={formData.campaignName} onChange={(e) => handleInputChange('campaignName', e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="field-label">Description <span className="required-asterisk">*</span></label>
                  <textarea className="field-textarea" placeholder="Description field" value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} rows={4} />
                </div>
                <div className="form-field">
                  <label className="field-label">Financial goal</label>
                  <input type="text" className="field-input" placeholder="$0.00" value={formData.financialGoal} onChange={handleFinancialGoalChange} />
                </div>
                <div className="form-row">
                    <div className="form-field"><label className="field-label">Start date <span className="info-icon">ℹ️</span></label><input type="date" className="field-input" value={formData.startDate} onChange={(e) => handleInputChange('startDate', e.target.value)} /></div>
                    <div className="form-field"><label className="field-label">End date <span className="info-icon">ℹ️</span></label><input type="date" className="field-input" value={formData.endDate} onChange={(e) => handleInputChange('endDate', e.target.value)} /></div>
                </div>
                <h3 className="form-section-subtitle">Contact</h3>
                <div className="form-field"><label className="field-label">Phone number</label><input type="tel" className="field-input" placeholder="Enter contact phone number" value={formData.phoneNumber} onChange={(e) => handleInputChange('phoneNumber', e.target.value)} /></div>
                <div className="form-field"><label className="field-label">Email address</label><input type="email" className="field-input" placeholder="Enter contact email address" value={formData.emailAddress} onChange={(e) => handleInputChange('emailAddress', e.target.value)} /></div>
                <div className="contact-info-text">This contact information displays in the donor portal. <a href="#" className="info-link">Learn more</a></div>
                <div className="form-actions">
                  <button className="btn-cancel">Cancel</button>
                  <button className="btn-draft">Save as draft</button>
                  <button className={`btn-next ${mandatoryFieldsFilled ? 'enabled' : 'disabled'}`} disabled={!mandatoryFieldsFilled} onClick={() => mandatoryFieldsFilled && setCurrentStep(2)}>Next: Assign campuses →</button>
                </div>
              </div>
            )}
  
            {currentStep === 2 && (
              <div className="campaign-form">
                  {/* Donation Destination Logic - RESTORED */ }
                  <div className="form-section">
                    <h3 className="section-title">Choose where donations go</h3>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input type="radio" name="donationDestination" value="fund" checked={donationDestination === 'fund'} onChange={(e) => setDonationDestination(e.target.value)} />
                        <span className="radio-label">Org Fund</span>
                      </label>
                      <label className="radio-option">
                        <input type="radio" name="donationDestination" value="campus" checked={donationDestination === 'campus'} onChange={(e) => setDonationDestination(e.target.value)} />
                        <span className="radio-label">Campus</span>
                      </label>
                    </div>
                    {donationDestination === 'fund' && (
                    <div className="org-fund-selection">
                        <label className="org-fund-label">Select organization listing</label>
                        <select className="org-fund-select" value={orgFundListing} onChange={(e) => setOrgFundListing(e.target.value)}>
                            <option value="">Select org listing</option>
                            {orgFundListings.map((listing) => (<option key={listing.id} value={listing.id}>{listing.name}</option>))}
                            {orgFundListings.length === 0 && (<option value="" disabled>No organization listings available</option>)}
                        </select>
                    </div>
                    )}
                  </div>

                  <div className="financial-goal-section">
                      <h3 className="section-title">Financial goal</h3>
                      <div className="financial-goal-display">
                          <div>
                            <div className="label">Financial goal for your campaign</div>
                            <input
                                type="text"
                                className="amount-input"
                                value={formData.financialGoal}
                                onChange={handleFinancialGoalChange}
                                onBlur={(e) => handleFinancialGoalChange(e)}
                                placeholder="$0.00"
                            />
                          </div>
                      </div>
                      <div className="split-goal-option">
                          <input 
                          type="checkbox" 
                          id="split-goal"
                          checked={splitGoal}
                          onChange={(e) => setSplitGoal(e.target.checked)}
                          disabled={!formData.financialGoal || campuses.filter(c => c.selected).length === 0}
                          />
                          <label htmlFor="split-goal">Evenly split across selected campuses</label>
                      </div>
                  </div>
  
                  <div className="financial-goal-section" style={{marginTop: '24px'}}>
                      <h3 className="section-title">Select campus and choose listings</h3>
                      <div className="search-container">
                      <input type="text" placeholder="Search" className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                      </div>
  
                      <div className="campus-table">
                      <div className="table-header">
                          <div className="header-cell">Campus</div>
                          <div className="header-cell">Listings</div>
                          <div className="header-cell" style={{textAlign: 'right'}}>Goal per campus</div>
                      </div>
                      
                      {currentCampuses.map((campus) => (
                          <div key={campus.id} className="table-row">
                              <div className="campus-cell">
                              <label className="campus-checkbox">
                                  <input type="checkbox" checked={campus.selected || false} onChange={() => handleCampusToggle(campus.id)} />
                                  <div className="campus-info">
                                  <div className="campus-name">{campus.name}</div>
                                  <div className="campus-address">{campus.address}</div>
                                  </div>
                              </label>
                              </div>
                              <div className="listings-cell">
                              <div className="listings-multiselect">
                                  <div className={`multiselect-header ${!campus.selected || donationDestination !== 'campus' ? 'disabled' : ''}`} onClick={() => campus.selected && donationDestination === 'campus' && handleDropdownToggle(campus.id)}>
                                      <span className="multiselect-placeholder">
                                        {donationDestination === 'fund' ? 'Donations go to org fund' : !campus.selected ? 'N/A' : (campus.selectedListings?.length > 0 ? `${campus.selectedListings.length} selected` : 'Select listing')}
                                      </span>
                                      <span className={`dropdown-arrow ${!campus.selected || donationDestination !== 'campus' ? 'disabled' : ''}`}>▼</span>
                                  </div>
                                  {campus.showDropdown && campus.selected && donationDestination === 'campus' && (
                                      <div className="multiselect-dropdown">
                                          {campus.availableListings?.length > 0 ? campus.availableListings.map(listing => (
                                              <label key={listing.id} className="multiselect-option"><input type="checkbox" checked={campus.selectedListings?.includes(listing.id) || false} onChange={(e) => handleListingToggle(campus.id, listing.id, e.target.checked)} /><span>{listing.name}</span></label>
                                          )) : <div className="multiselect-option disabled">No listings available</div>}
                                      </div>
                                  )}
                              </div>
                              </div>
                              <div className="goal-input-cell">
                              <input
                                  type="text"
                                  className="goal-input"
                                  placeholder="$0.00"
                                  value={campusGoals[campus.id] ? formatCurrency(campusGoals[campus.id]) : ''}
                                  onChange={(e) => handleCampusGoalChange(campus.id, e.target.value)}
                                  onBlur={(e) => { const formatted = formatCurrency(e.target.value); handleCampusGoalChange(campus.id, formatted);}}
                                  disabled={!campus.selected}
                              />
                              </div>
                          </div>
                      ))}
                      </div>
  
                      <div className="pagination">
                        <button className="pagination-arrow" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>❮</button>
                        <span className="pagination-info">{filteredCampuses.length === 0 ? 'No campuses found' : `${startIndex + 1} - ${Math.min(endIndex, filteredCampuses.length)} of ${filteredCampuses.length} campuses`}</span>
                        <button className="pagination-arrow" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>❯</button>
                      </div>
                  </div>
  
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => setCurrentStep(1)}>Back</button>
                  <button className="btn-draft">Save as draft</button>
                  <button 
                    className={`btn-next ${isStep2Valid ? 'enabled' : 'disabled'}`} 
                    disabled={!isStep2Valid}
                    onClick={handleGoToFundStep}
                  >
                    Next: Set up fund →
                  </button>
                </div>
              </div>
            )}
  
            {currentStep === 3 && (
              <div className="campaign-form">
                 <h2 className="form-section-title">Fund details</h2>
      
                  <div className="form-field">
                  <label className="field-label">Fund name <span className="required-asterisk">*</span></label>
                  <input type="text" className="field-input" placeholder="#Campaign Name#" value={fundData.fundName} onChange={(e) => setFundData(prev => ({...prev, fundName: e.target.value}))} />
                  </div>
  
                  <div className="form-field">
                  <label className="field-label">Code <span className="info-icon">ℹ️</span></label>
                  <input type="text" className="field-input" placeholder="Enter the code" value={fundData.fundCode} onChange={(e) => setFundData(prev => ({...prev, fundCode: e.target.value}))} />
                  </div>
  
                  <div className="form-field">
                  <label className="field-label">Tax deductible <span className="required-asterisk">*</span> <span className="info-icon">ℹ️</span></label>
                  <div className="radio-group">
                      <label className="radio-option"><input type="radio" name="taxDeductible" value="yes" checked={fundData.taxDeductible === true} onChange={() => setFundData(prev => ({...prev, taxDeductible: true}))} /><span className="radio-label">Yes</span></label>
                      <label className="radio-option"><input type="radio" name="taxDeductible" value="no" checked={fundData.taxDeductible === false} onChange={() => setFundData(prev => ({...prev, taxDeductible: false}))} /><span className="radio-label">No</span></label>
                  </div>
                  </div>
  
                  <div className="form-field">
                  <label className="field-label">Thank you message <span className="required-asterisk">*</span></label>
                  <textarea className="field-textarea" placeholder="Thank you message field" value={fundData.thankYouMessage} onChange={(e) => setFundData(prev => ({...prev, thankYouMessage: e.target.value}))} rows={4} />
                  <div className="character-count">{fundData.thankYouMessage ? fundData.thankYouMessage.length : 0}/500 characters</div>
                  </div>
  
                  <div className="form-field">
                  <label className="field-label">Thank you animation <span className="info-icon">ℹ️</span></label>
                  <div className="animation-options">
                      <div className={`animation-option ${fundData.thankYouAnimation === 'none' ? 'selected' : ''}`} onClick={() => setFundData(prev => ({...prev, thankYouAnimation: 'none'}))}><div className="animation-icon">✕</div><div className="animation-label">None</div></div>
                      <div className={`animation-option ${fundData.thankYouAnimation === 'hearts' ? 'selected' : ''}`} onClick={() => setFundData(prev => ({...prev, thankYouAnimation: 'hearts'}))}><div className="animation-icon">♥</div><div className="animation-label">Hearts</div></div>
                      <div className={`animation-option ${fundData.thankYouAnimation === 'confetti' ? 'selected' : ''}`} onClick={() => setFundData(prev => ({...prev, thankYouAnimation: 'confetti'}))}><div className="animation-icon">🎉</div><div className="animation-label">Confetti</div></div>
                  </div>
                  </div>
                  <div className="form-actions">
                      <button className="btn-cancel" onClick={() => setCurrentStep(2)}>Back</button>
                      <button className="btn-draft">Save as draft</button>
                      <button 
                          className={`btn-next ${fundData.fundName.trim() !== '' && fundData.thankYouMessage.trim() !== '' ? 'enabled' : 'disabled'}`}
                          disabled={!(fundData.fundName.trim() !== '' && fundData.thankYouMessage.trim() !== '') || loading}
                          onClick={handlePublishCampaign}
                      >
                          {loading ? 'Publishing...' : 'Publish campaign'}
                      </button>
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

export default CreateCampaign;