import React, { useState } from 'react';
import './LeadForm.css';

function LeadForm() {
  const [lead, setLead] = useState({
    leadOwner: '',
    firstName: '',
    lastName: '',
    company: '',
    mobile: '',
    email: '',
    fax: '',
    website: '',
    leadSource: '',
    leadStatus: '',
    industry: '',
    employees: '',
    revenue: '',
    social: '',
    description: '',
    street: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
    additionalDescription: ''
  });

  const handleChange = (e) => {
    setLead({ ...lead, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Submitting lead:\n' + JSON.stringify(lead, null, 2));
    // TODO: Connect to Apps Script endpoint via fetch
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '700px', margin: '2rem auto', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '8px' }}>
      <h2>New Lead</h2>

      <div className="form-grid">
        <label>Lead Owner</label>
        <input type="text" name="leadOwner" onChange={handleChange} />

        <label>First Name</label>
        <input type="text" name="firstName" onChange={handleChange} />

        <label>Last Name</label>
        <input type="text" name="lastName" onChange={handleChange} />

        <label>Company</label>
        <input type="text" name="company" onChange={handleChange} />

        <label>Mobile</label>
        <input type="text" name="mobile" onChange={handleChange} />

        <label>Email</label>
        <input type="email" name="email" onChange={handleChange} />

        <label>Fax</label>
        <input type="text" name="fax" onChange={handleChange} />

        <label>Website</label>
        <input type="text" name="website" onChange={handleChange} />

        <label>Lead Source</label>
        <input type="text" name="leadSource" onChange={handleChange} />

        <label>Lead Status</label>
        <select name="leadStatus" onChange={handleChange}>
          <option value="">Select</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Qualified">Qualified</option>
        </select>

        <label>Industry</label>
        <input type="text" name="industry" onChange={handleChange} />

        <label>No. of Employees</label>
        <input type="number" name="employees" onChange={handleChange} />

        <label>Annual Revenue</label>
        <input type="text" name="revenue" onChange={handleChange} />

        <label>Social Media</label>
        <input type="text" name="social" onChange={handleChange} />

        <label>Description</label>
        <textarea name="description" onChange={handleChange}></textarea>

        <label>Street</label>
        <input type="text" name="street" onChange={handleChange} />

        <label>City</label>
        <input type="text" name="city" onChange={handleChange} />

        <label>State</label>
        <input type="text" name="state" onChange={handleChange} />

        <label>Country</label>
        <input type="text" name="country" onChange={handleChange} />

        <label>Pincode</label>
        <input type="text" name="pincode" onChange={handleChange} />

        <label>Additional Description</label>
        <textarea name="additionalDescription" onChange={handleChange}></textarea>
      </div>

      <button type="submit" style={{ marginTop: '1rem' }}>Submit Lead</button>
    </form>
  );
}

export default LeadForm;
