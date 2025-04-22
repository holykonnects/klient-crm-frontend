import React, { useState } from 'react';

function LeadForm() {
  const [lead, setLead] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    status: 'New'
  });

  const handleChange = (e) => {
    setLead({ ...lead, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(JSON.stringify(lead, null, 2));
    // Here we'll later connect to Google Apps Script backend
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <input type="text" name="firstName" placeholder="First Name" onChange={handleChange} /><br />
      <input type="text" name="lastName" placeholder="Last Name" onChange={handleChange} /><br />
      <input type="text" name="mobile" placeholder="Mobile Number" onChange={handleChange} /><br />
      <input type="email" name="email" placeholder="Email" onChange={handleChange} /><br />
      <select name="status" onChange={handleChange}>
        <option value="New">New</option>
        <option value="Contacted">Contacted</option>
        <option value="Qualified">Qualified</option>
      </select><br />
      <button type="submit">Submit Lead</button>
    </form>
  );
}

export default LeadForm;
