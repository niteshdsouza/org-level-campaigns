import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function AssignCampuses() {
  const navigate = useNavigate();
  
  // Sample campus data (will come from Airtable later)
  const [campuses] = useState([
    { id: 1, name: 'All Saints', address: '742 Evergreen Terrace, Springfield, 12345', selected: true },
    { id: 2, name: 'All Saints', address: '742 Evergreen Terrace, Springfield, 12345', selected: true },
    { id: 3, name: 'All Saints', address: '742 Evergreen Terrace, Springfield, 12345', selected: true },
    { id: 4, name: 'All Saints', address: '742 Evergreen Terrace, Springfield, 12345', selected: true },
    { id: 5, name: 'All Saints', address: '742 Evergreen Terrace, Springfield, 12345', selected: true },
    { id: 6, name: 'All Saints', address: '742 Evergreen Terrace, Springfield, 12345', selected: true },
    { id: 7, name: 'All Saints', address: '742 Evergreen Terrace, Springfield, 12345', selected: true },
    { id: 8, name: 'All Saints', address: '742 Evergreen Terrace, Springfield, 12345', selected: true }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [donationDestination, setDonationDestination] = useState('fund'); // 'fund' or 'campus'
  
  const itemsPerPage = 8;
  const totalPages = Math.ceil(campuses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCampuses = campuses.slice(startIndex, endIndex);

  const handleCampusToggle = (campusId) => {
    // Toggle campus selection logic will go here
    console.log('Toggle campus:', campusId);
  };

  const handleListingChange = (campusId, listingValue) => {
    // Handle listing assignment logic will go here
    console.log('Campus:', campusId, 'Listing:', listingValue);
  };

  const handleSaveAsDraft = () => {
    // Save as draft logic
    console.log('Saving as draft...');
  };

  const handleNext = () => {
    navigate('/create-fund');
  };

  const handleCancel = () => {
    navigate('/org-admin');
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo">
          <span className="logo-icon">💰</span>
          <span className="logo-text">Pushpay</span>
        </div>
        
        <div className="menu">
          <div className="menu-item">
            <span className="menu-icon">💰</span>
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
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="content-header">
          <h1>Create campaign</h1>
        </div>

        {/* Progress Steps */}
        <div className="create-campaign-progress">
          <div className="progress-step">
            <div className="step-circle active">✓</div>
            <span className="step-label">1. Step name</span>
          </div>
          <div className="progress-step">
            <div className="step-circle active">2</div>
            <span className="step-label">2. Step name</span>
          </div>
          <div className="progress-step">
            <div className="step-circle">3</div>
            <span className="step-label">3. Create fund</span>
          </div>
        </div>

        {/* Campus Assignment Form */}
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
          </div>

          {/* Campus Selection */}
          <div className="form-section">
            <h3 className="section-title">Select campus and choose listings</h3>
            
            {/* Search */}
            <div className="search-container">
              <input
                type="text"
                placeholder="Search"
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-button">🔍</button>
            </div>

            {/* Campus Table */}
            <div className="campus-table">
              <div className="table-header">
                <div className="header-cell">Campus</div>
                <div className="header-cell">Listings</div>
              </div>
              
              {currentCampuses.map((campus) => (
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
                    <select 
                      className="listings-select"
                      onChange={(e) => handleListingChange(campus.id, e.target.value)}
                    >
                      <option value="">#Listing name#</option>
                      <option value="listing1">Listing 1</option>
                      <option value="listing2">Listing 2</option>
                      <option value="listing3">Listing 3</option>
                    </select>
                  </div>
                </div>
              ))}
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
                {startIndex + 1} - {Math.min(endIndex, campuses.length)} of {campuses.length} campuses
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

          {/* Action Buttons */}
          <div className="form-actions">
            <button className="btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn-outline" onClick={handleSaveAsDraft}>
              Save as draft
            </button>
            <button className="btn-primary" onClick={handleNext}>
              Next: Set up fund →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssignCampuses;