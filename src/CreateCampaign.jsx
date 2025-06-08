import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { fetchCampuses, fetchListings, fetchOrgFundListings, createFund, createCampaign } from './airtable';

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


  // NEW: Add campus assignment state - CHANGED: Start with no selection
  const [donationDestination, setDonationDestination] = useState(''); // Start with no selection
  const [orgFundListing, setOrgFundListing] = useState(''); // For org fund dropdown
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Sample campus data (will come from Airtable later)
  const [campuses, setCampuses] = useState([]);

  // Filter campuses based on search query
  const filteredCampuses = campuses.filter(campus =>
    campus.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const itemsPerPage = 8;
  const totalPages = Math.ceil(filteredCampuses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCampuses = filteredCampuses.slice(startIndex, endIndex);

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

// Load campuses, listings, and org fund listings from Airtable
useEffect(() => {
  const loadData = async () => {
    try {
      setLoadingCampuses(true);
      
      // Fetch all data in parallel
      const [campusesData, listingsData, orgFundListingsData] = await Promise.all([
        fetchCampuses(),
        fetchListings(),
        fetchOrgFundListings()
      ]);
      
      // Match listings to campuses
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

  // Check if mandatory fields are filled
  const mandatoryFieldsFilled = 
    formData.campaignName.trim() !== '' && 
    formData.description.trim() !== '';

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // NEW: Add campus handlers
  const handleCampusToggle = (campusId) => {
    setCampuses(prev => prev.map(campus => 
      campus.id === campusId 
        ? { 
            ...campus, 
            selected: !campus.selected,
            // Clear listings and close dropdown when campus is unchecked
            selectedListings: !campus.selected ? campus.selectedListings : [],
            showDropdown: false
          }
        : campus
    ));
  };

  const handleListingToggle = (campusId, listingValue, isChecked) => {
    setCampuses(prev => prev.map(campus => 
      campus.id === campusId 
        ? { 
            ...campus, 
            selectedListings: isChecked 
              ? [...(campus.selectedListings || []), listingValue]
              : (campus.selectedListings || []).filter(item => item !== listingValue)
          }
        : campus
    ));
  };

  const handleDropdownToggle = (campusId) => {
    setCampuses(prev => prev.map(campus => 
      campus.id === campusId 
        ? { ...campus, showDropdown: !campus.showDropdown }
        : { ...campus, showDropdown: false } // Close other dropdowns
    ));
  };

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

  const handleFinancialGoalChange = (e) => {
    const formatted = formatCurrency(e.target.value);
    handleInputChange('financialGoal', formatted);
  };

  // Handle final campaign creation
const handleCreateCampaign = async () => {
  try {
    setLoading(true);
    console.log('Starting campaign creation process...');

    // Step 1: Create the fund first
    console.log('Step 1: Creating fund...');
    const createdFund = await createFund(fundData);
    
    // Step 2: Get selected campuses
    const selectedCampuses = campuses.filter(campus => campus.selected);
    const selectedCampusIds = selectedCampuses.map(campus => campus.id);
    
    // Step 3: Create the campaign and link it to the fund
    console.log('Step 2: Creating campaign...');
    const campaignData = {
      ...formData,
      donationDestination,
      orgFundListing
    };
    
    const createdCampaign = await createCampaign(campaignData, createdFund.id, selectedCampusIds);
    
    // Success!
    console.log('✅ Campaign creation completed!');
    alert(`Campaign "${createdCampaign.name}" created successfully with fund "${createdFund.name}"!`);
    // Redirect to campaigns overview page
    navigate('/org-admin');

  } catch (error) {
    console.error('❌ Campaign creation failed:', error);
    alert(`Failed to create campaign: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="app-layout">
      {/* Reuse existing sidebar */}
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
          <div className="menu-item">
            <span className="menu-icon">📊</span>
            Dashboard
          </div>
          <div className="menu-item">
            <span className="menu-icon">💰</span>
            Finance
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🔄</span>
            Reconciliation
          </div>
          <div className="menu-item">
            <span className="menu-icon">💼</span>
            Funds
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">📈</span>
            Campaigns
            <span className="expand-arrow">▼</span>
          </div>
          <div className="submenu">
            <div className="submenu-item">Overview</div>
            <div className="submenu-item">Add a pledge</div>
          </div>
          <div className="menu-item">
            <span className="menu-icon">👥</span>
            Community
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">📊</span>
            App Analytics
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🤝</span>
            Donor Development
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🔄</span>
            Recurring
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">🎁</span>
            Gift Entry
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">📋</span>
            Giving Statements
          </div>
          <div className="menu-item">
            <span className="menu-icon">📚</span>
            Resource Center
          </div>
          <div className="menu-item">
            <span className="menu-icon">⚙️</span>
            Settings
            <span className="expand-arrow">▼</span>
          </div>
          <div className="menu-item">
            <span className="menu-icon">💬</span>
            Feedback
          </div>
        </div>
      </div>

      {/* Main content using existing structure */}
      <div className="main-content">
        <div className="breadcrumb">
          <span className="breadcrumb-link">Campaigns</span>
          <span className="breadcrumb-separator">›</span>
          <span>Overview</span>
        </div>

        <div className="dashboard">
          <div className="dashboard-header">
            <h1>Create campaign</h1>
          </div>
          
          {/* Progress Steps */}
          <div className="create-campaign-progress">
            <div className="progress-step">
              <div className={`step-circle ${currentStep >= 1 ? 'active' : ''}`}>
                {currentStep > 1 ? '✓' : '1'}
              </div>
              <span className="step-label">Campaign details</span>
            </div>
            <div className="progress-line"></div>
            <div className="progress-step">
              <div className={`step-circle ${currentStep >= 2 ? 'active' : ''}`}>
                {currentStep > 2 ? '✓' : '2'}
              </div>
              <span className="step-label">Assign campuses</span>
            </div>
            <div className="progress-line"></div>
            <div className="progress-step">
              <div className={`step-circle ${currentStep >= 3 ? 'active' : ''}`}>
                {currentStep > 3 ? '✓' : '3'}
              </div>
              <span className="step-label">Create fund</span>
            </div>
          </div>

          {/* STEP 1: Campaign Details Form */}
          {currentStep === 1 && (
            <div className="campaign-form">
              <h2 className="form-section-title">Campaign Details</h2>
              
              <div className="form-field">
                <label className="field-label">
                  Campaign name <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Enter campaign name"
                  value={formData.campaignName}
                  onChange={(e) => handleInputChange('campaignName', e.target.value)}
                />
                <div className="character-count">
                  {formData.campaignName.length}/40 characters
                </div>
              </div>

              <div className="form-field">
                <label className="field-label">
                  Description <span className="required-asterisk">*</span>
                </label>
                <textarea
                  className="field-textarea"
                  placeholder="Description field"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                />
                <div className="character-count">
                  {formData.description.length}/500 characters
                </div>
              </div>

              <div className="form-field">
                <label className="field-label">Financial goal</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="$0"
                  value={formData.financialGoal}
                  onChange={handleFinancialGoalChange}
                />
              </div>

              <div className="form-row">
                  <div className="form-field">
                      <label className="field-label">
                      Start date <span className="info-icon">ℹ️</span>
                      </label>
                      <input
                      type="date"
                      className="field-input"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      />
                  </div>
                  <div className="form-field">
                      <label className="field-label">
                      End date <span className="info-icon">ℹ️</span>
                      </label>
                      <input
                      type="date"
                      className="field-input"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      />
                  </div>
              </div>

              <h3 className="form-section-subtitle">Contact</h3>
              
              <div className="form-field">
                <label className="field-label">Phone number</label>
                <input
                  type="tel"
                  className="field-input"
                  placeholder="Enter contact phone number"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="field-label">Email address</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="Enter contact email address"
                  value={formData.emailAddress}
                  onChange={(e) => handleInputChange('emailAddress', e.target.value)}
                />
              </div>

              <div className="contact-info-text">
                This contact information displays in the donor portal. <a href="#" className="info-link">Learn more</a>
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                <button className="btn-cancel">Cancel</button>
                <button className="btn-draft">Save as draft</button>
                <button 
                  className={`btn-next ${mandatoryFieldsFilled ? 'enabled' : 'disabled'}`}
                  disabled={!mandatoryFieldsFilled}
                  onClick={() => mandatoryFieldsFilled && setCurrentStep(2)}
                >
                  Next: Assign campuses →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Assign Campuses */}
          {currentStep === 2 && (
            <div className="campaign-form">
              {/* Donation Destination */}
              <div className="form-section">
                <h3 className="section-title">Choose where donations go</h3>
                
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="donationDestination"
                      value="fund"
                      checked={donationDestination === 'fund'}
                      onChange={(e) => setDonationDestination(e.target.value)}
                    />
                    <span className="radio-label">Org Fund</span>
                  </label>
                  
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="donationDestination"
                      value="campus"
                      checked={donationDestination === 'campus'}
                      onChange={(e) => setDonationDestination(e.target.value)}
                    />
                    <span className="radio-label">Campus</span>
                  </label>
                </div>

                {/* Org Fund Dropdown - Only show when Org Fund is selected */}
                {donationDestination === 'fund' && (
                  <div className="org-fund-selection">
                    <label className="org-fund-label">Select organization listing</label>
                    <select 
                      className="org-fund-select"
                      value={orgFundListing}
                      onChange={(e) => setOrgFundListing(e.target.value)}
                    >
                      <option value="">Select org listing</option>
                      {orgFundListings.map((listing) => (
                        <option key={listing.id} value={listing.id}>
                          {listing.name}
                        </option>
                      ))}
                      {orgFundListings.length === 0 && (
                        <option value="" disabled>No organization listings available</option>
                      )}
                    </select>
                  </div>
                )}
              </div>

              {/* Campus Selection */}
              <div className="form-section">
                <h3 className="section-title">
                  Select campus and choose listings
                </h3>
                
                {/* Search */}
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search"
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button className="campus-search-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </button>
                </div>

                {/* Campus Table */}
                <div className="campus-table">
                  <div className="table-header">
                    <div className="header-cell">Campus</div>
                    <div className="header-cell">Listings</div>
                  </div>
                  
                  {currentCampuses.length === 0 ? (
                    <div className="no-results">
                      <div className="no-results-message">
                        {searchQuery 
                          ? `No campuses found matching "${searchQuery}"`
                          : 'No campuses available'
                        }
                      </div>
                    </div>
                  ) : (
                    currentCampuses.map((campus) => (
                      <div key={campus.id} className="table-row">
                        <div className="campus-cell">
                          <label className="campus-checkbox">
                            <input
                              type="checkbox"
                              checked={campus.selected}
                              onChange={() => handleCampusToggle(campus.id)}
                            />
                            <div className="campus-info">
                              <div className="campus-name">{campus.name}</div>
                              <div className="campus-address">{campus.address}</div>
                            </div>
                          </label>
                        </div>
                        <div className="listings-cell">
                          <div className="listings-multiselect">
                            <div 
                              className={`multiselect-header ${!campus.selected || donationDestination === 'fund' ? 'disabled' : ''}`}
                              onClick={() => campus.selected && donationDestination === 'campus' && handleDropdownToggle(campus.id)}
                            >
                              <span className="multiselect-placeholder">
                                {donationDestination === 'fund'
                                  ? 'Donations go to org fund'
                                  : donationDestination === ''
                                    ? 'Select donation destination first'
                                    : !campus.selected 
                                      ? 'Select campus first'
                                      : campus.selectedListings && campus.selectedListings.length > 0 
                                        ? `${campus.selectedListings.length} listing(s) selected`
                                        : 'Select your listing'
                                }
                              </span>
                              <span className={`dropdown-arrow ${!campus.selected || donationDestination !== 'campus' ? 'disabled' : ''}`}>▼</span>
                            </div>
                            {campus.showDropdown && campus.selected && donationDestination === 'campus' && (
                            <div className="multiselect-dropdown">
                              {campus.availableListings && campus.availableListings.length > 0 ? (
                                campus.availableListings.map((listing) => (
                                  <label key={listing.id} className="multiselect-option">
                                    <input
                                      type="checkbox"
                                      checked={campus.selectedListings?.includes(listing.id) || false}
                                      onChange={(e) => handleListingToggle(campus.id, listing.id, e.target.checked)}
                                    />
                                    <span>{listing.name}</span>
                                  </label>
                                ))
                                ) : (
                                <div className="multiselect-option" style={{color: '#9ca3af'}}>
                                  No listings available for this campus
                                </div>
                              )}
                            </div>
                          )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                <div className="pagination">
                  <button 
                    className="pagination-arrow"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    ❮
                  </button>
                  <span className="pagination-info">
                    {filteredCampuses.length === 0 
                      ? 'No campuses found'
                      : `${startIndex + 1} - ${Math.min(endIndex, filteredCampuses.length)} of ${filteredCampuses.length} campuses`
                    }
                    {searchQuery && ` (filtered from ${campuses.length} total)`}
                  </span>
                  <button 
                    className="pagination-arrow"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    ❯
                  </button>
                </div>
              </div>

              {/* Step 2 Action Buttons */}
              <div className="form-actions">
                <button className="btn-cancel" onClick={() => setCurrentStep(1)}>
                  Back
                </button>
                <button className="btn-draft">
                  Save as draft
                </button>
                <button className="btn-next" onClick={() => setCurrentStep(3)}>
                  Next: Set up fund →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Create Fund (placeholder) */}
          {currentStep === 3 && (
  <div className="campaign-form">
    <h2 className="form-section-title">Fund details</h2>
    
    <div className="form-field">
      <label className="field-label">
        Fund name <span className="required-asterisk">*</span>
      </label>
      <input
        type="text"
        className="field-input"
        placeholder="#Campaign Name#"
        value={fundData.fundName}
        onChange={(e) => setFundData(prev => ({...prev, fundName: e.target.value}))}
      />
    </div>

    <div className="form-field">
      <label className="field-label">
        Code <span className="info-icon">ℹ️</span>
      </label>
      <input
        type="text"
        className="field-input"
        placeholder="Enter the code"
        value={fundData.fundCode}
        onChange={(e) => setFundData(prev => ({...prev, fundCode: e.target.value}))}
      />
    </div>

    <div className="form-field">
      <label className="field-label">
        Tax deductible <span className="required-asterisk">*</span> <span className="info-icon">ℹ️</span>
      </label>
      <div className="radio-group">
        <label className="radio-option">
          <input
            type="radio"
            name="taxDeductible"
            value="yes"
            checked={fundData.taxDeductible === true}
            onChange={() => setFundData(prev => ({...prev, taxDeductible: true}))}
          />
          <span className="radio-label">Yes</span>
        </label>
        
        <label className="radio-option">
          <input
            type="radio"
            name="taxDeductible"
            value="no"
            checked={fundData.taxDeductible === false}
            onChange={() => setFundData(prev => ({...prev, taxDeductible: false}))}
          />
          <span className="radio-label">No</span>
        </label>
      </div>
    </div>

    <div className="form-field">
      <label className="field-label">
        Thank you message <span className="required-asterisk">*</span>
      </label>
      <textarea
        className="field-textarea"
        placeholder="Thank you message field"
        value={fundData.thankYouMessage}
        onChange={(e) => setFundData(prev => ({...prev, thankYouMessage: e.target.value}))}
        rows={4}
      />
      <div className="character-count">
        {fundData.thankYouMessage ? fundData.thankYouMessage.length : 0}/500 characters
      </div>
    </div>

    <div className="form-field">
      <label className="field-label">
        Thank you animation <span className="info-icon">ℹ️</span>
      </label>
      <div className="animation-options">
        <div 
          className={`animation-option ${fundData.thankYouAnimation === 'none' ? 'selected' : ''}`}
          onClick={() => setFundData(prev => ({...prev, thankYouAnimation: 'none'}))}
        >
          <div className="animation-icon">✕</div>
          <div className="animation-label">None</div>
        </div>
        
        <div 
          className={`animation-option ${fundData.thankYouAnimation === 'hearts' ? 'selected' : ''}`}
          onClick={() => setFundData(prev => ({...prev, thankYouAnimation: 'hearts'}))}
        >
          <div className="animation-icon">♥</div>
          <div className="animation-label">Hearts</div>
        </div>
        
        <div 
          className={`animation-option ${fundData.thankYouAnimation === 'confetti' ? 'selected' : ''}`}
          onClick={() => setFundData(prev => ({...prev, thankYouAnimation: 'confetti'}))}
        >
          <div className="animation-icon">🎉</div>
          <div className="animation-label">Confetti</div>
        </div>
      </div>
    </div>

    {/* Action Buttons */}
    <div className="form-actions">
      <button className="btn-cancel" onClick={() => setCurrentStep(2)}>
        Cancel
      </button>
      <button className="btn-draft">
        Save as draft
      </button>
      <button 
  className={`btn-next ${
    fundData.fundName.trim() !== '' && 
    fundData.thankYouMessage.trim() !== '' && 
    (fundData.taxDeductible === true || fundData.taxDeductible === false)
    ? 'enabled' : 'disabled'
  }`}
  disabled={
    !(fundData.fundName.trim() !== '' && 
      fundData.thankYouMessage.trim() !== '' && 
      (fundData.taxDeductible === true || fundData.taxDeductible === false)) || loading
  }
  onClick={handleCreateCampaign}
>
  {loading ? 'Creating...' : 'Next: Publish campaign →'}
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