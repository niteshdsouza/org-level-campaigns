// ShareModal.jsx
import { useState, useEffect } from 'react';
import { fetchCampuses, fetchListings, fetchOrgFundListings } from './airtable';
import './ShareModal.css';

function ShareModal({ campaign, userRole, userCampuses, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [listings, setListings] = useState([]);
  const [orgListing, setOrgListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        console.log('ShareModal: Loading data for campaign:', campaign);
        console.log('ShareModal: User role:', userRole, 'User campuses:', userCampuses);
        
        // Fetch all required data
        const [allCampuses, allListings, orgListings] = await Promise.all([
          fetchCampuses(),
          fetchListings(),
          fetchOrgFundListings()
        ]);

        console.log('ShareModal: Fetched campuses:', allCampuses);
        console.log('ShareModal: Fetched listings:', allListings);
        console.log('ShareModal: Fetched org listings:', orgListings);

        // Filter campuses based on campaign's assigned campuses
        let relevantCampuses = allCampuses.filter(campus => 
          campaign.assignedCampuses.includes(campus.id)
        );

        console.log('ShareModal: Relevant campuses after campaign filter:', relevantCampuses);

        // Further filter based on user role
        if (userRole === 'single-campus' || userRole === 'multi-campus') {
          relevantCampuses = relevantCampuses.filter(campus => 
            userCampuses.includes(campus.id)
          );
          console.log('ShareModal: Relevant campuses after role filter:', relevantCampuses);
        }

        setCampuses(relevantCampuses);
        setListings(allListings);

        // For org destination campaigns, find the specific org listing
        if (campaign.donationDestination === 'Org Fund' && campaign.orgFundListing) {
          console.log('ShareModal: Looking for org listing:', campaign.orgFundListing);
          console.log('ShareModal: orgFundListing type:', typeof campaign.orgFundListing);
          console.log('ShareModal: orgFundListing is array:', Array.isArray(campaign.orgFundListing));
          
          // Handle different possible formats of orgFundListing
          let orgListingName;
          if (Array.isArray(campaign.orgFundListing)) {
            orgListingName = campaign.orgFundListing[0];
          } else if (typeof campaign.orgFundListing === 'string') {
            orgListingName = campaign.orgFundListing;
          } else {
            console.log('ShareModal: Unknown orgFundListing format:', campaign.orgFundListing);
          }
          
          console.log('ShareModal: Searching for listing name:', orgListingName);
          
          // The orgFundListing contains Airtable record IDs, not names
          // So we need to search by ID, not name
          const orgListingRecord = orgListings.find(listing => 
            listing.id === orgListingName
          );
          console.log('ShareModal: Found org listing:', orgListingRecord);
          setOrgListing(orgListingRecord);
        } else {
          console.log('ShareModal: Not org fund campaign or no org listing found');
          console.log('ShareModal: donationDestination:', campaign.donationDestination);
          console.log('ShareModal: orgFundListing:', campaign.orgFundListing);
        }

      } catch (error) {
        console.error('ShareModal: Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [campaign, userRole, userCampuses]);

  // Generate pledge link
  const generatePledgeLink = (campusId) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/pledge?campaign=${campaign.id}&campus=${campusId}`;
  };

  // Generate giving link
  const generateGivingLink = (campusId, listingId) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/give?campaign=${campaign.id}&campus=${campusId}&listing=${listingId}`;
  };

  // Get relevant listings for a campus
  const getListingsForCampus = (campusId) => {
    console.log('ShareModal: Getting listings for campus:', campusId);
    console.log('ShareModal: Campaign donation destination:', campaign.donationDestination);
    
    if (campaign.donationDestination === 'Org Fund') {
      // For org destination, return the single org listing
      console.log('ShareModal: Org destination - using org listing:', orgListing);
      return orgListing ? [orgListing] : [];
    } else {
      // For campus destination, return all listings for this campus
      const campusListings = listings.filter(listing => 
        listing.campusIds.includes(campusId)
      );
      console.log('ShareModal: Campus destination - found listings:', campusListings);
      return campusListings;
    }
  };

  const handleLinkClick = (url) => {
    console.log('ShareModal: Opening link:', url);
    window.open(url, '_blank');
  };

  // Handle click outside modal to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Filter campuses based on search query
  const filteredCampuses = campuses.filter(campus =>
    campus.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="modal-container">
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            Loading campaign sharing options...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="share-modal-container">
        <div className="share-modal-header">
          <h3 className="share-modal-title">Pledging & Giving Links</h3>
          <button className="share-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="share-modal-search">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="share-search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="share-modal-content">
          {filteredCampuses.length === 0 ? (
            <div className="no-campuses-message">
              {searchQuery ? 
                'No campuses found matching your search.' : 
                'No campuses available for this campaign or your role.'
              }
            </div>
          ) : (
            filteredCampuses.map((campus) => {
              const campusListings = getListingsForCampus(campus.id);
              
              return (
                <div key={campus.id} className="campus-share-section">
                  <h4 className="campus-share-name">{campus.name}</h4>
                  
                  <div className="share-links-container">
                    {/* Pledge Link Section */}
                    <div className="share-link-section">
                      <div className="share-section-header">
                        <span className="share-section-label">PLEDGE LINK</span>
                      </div>
                      <button
                        className="share-link-button pledge-link"
                        onClick={() => handleLinkClick(generatePledgeLink(campus.id))}
                      >
                        <span className="link-icon">🔗</span>
                        Copy Pledge Entry link
                      </button>
                    </div>

                    {/* Giving Links Section */}
                    <div className="share-link-section">
                      <div className="share-section-header">
                        <span className="share-section-label">GIVING LINKS</span>
                      </div>
                      {campusListings.length === 0 ? (
                        <div className="no-listings-message">
                          No giving links available for this campus
                        </div>
                      ) : (
                        campusListings.map((listing) => (
                          <button
                            key={listing.id}
                            className="share-link-button giving-link"
                            onClick={() => handleLinkClick(generateGivingLink(campus.id, listing.id))}
                          >
                            <span className="link-icon">🔗</span>
                            Copy {listing.name} link
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareModal;