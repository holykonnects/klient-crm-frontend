function onOpen() {
  // Add a custom menu to the Google Sheet
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Klient Konnect')
    .addItem('Create Deal', 'generatePrefilledLinks')
    .addToUi();
}

function generatePrefilledLinks() {
  // Specify your Google Sheet ID and the sheet name
  var sheetId = '1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8'; // Replace with your actual sheet ID
  var targetSheetName = 'Qualified Leads'; // Replace with your actual sheet name
  
  // Get the specified sheet
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(targetSheetName);
  
  // Get the range of data in the sheet
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();
  
  // Iterate through each row (skip header row)
  for (var i = 1; i < data.length; i++) {
    var responses = data[i];

    // Check if the required fields are not blank
    if (responses[0] && responses[1] && responses[2]) { // Checking End User, First Name, and Last Name
      // Check if the prefilled link already exists in column AS (index 44)
      if (!responses[43]) { // Column AS is index 43 (0-based)
        // Generate the prefilled link for the current row
        var prefilledLink = generatePrefilledLink(responses);
        
        // Create a clickable hyperlink
        var clickableLink = '=HYPERLINK("' + prefilledLink + '", "Create Deal")';
        
        // Update the 'Deal Creation' column (assuming column X is index 24)
        sheet.getRange(i + 1, 24).setFormula(clickableLink); // i + 1 for the correct row index
        Logger.log('Prefilled link generated and stored for row ' + (i + 1));
      }
    } else {
      Logger.log('Skipping row ' + (i + 1) + ' due to missing essential fields.');
    }
  }
}

function generatePrefilledLink(responses) {
  // Map the required fields to the corresponding entries
  var endUser = responses[0];       // Assuming column A stores End User
  var firstName = responses[1];     // Assuming column B stores First Name
  var lastName = responses[2];      // Assuming column C stores Last Name
  var company = responses[3];       // Assuming column D stores Company
  var mobileNumber = responses[4];  // Assuming column E stores Mobile Number
  var emailID = responses[5];       // Assuming column F stores Email ID
  var fax = responses[6];           // Assuming column G stores Fax
  var website = responses[7];       // Assuming column H stores Website
  var leadSource = responses[8];    // Assuming column I stores Lead Source
  var leadStatus = responses[9];    // Assuming column J stores Lead Status
  var industry = responses[10];     // Assuming column K stores Industry
  var numberOfEmployees = responses[11]; // Assuming column L stores Number of Employees
  var annualRevenue = responses[12]; // Assuming column M stores Annual Revenue
  var socialMedia = responses[13];  // Assuming column N stores Social Media
  var description = responses[14];  // Assuming column O stores Description
  var street = responses[15];       // Assuming column P stores Street
  var city = responses[16];         // Assuming column Q stores City
  var state = responses[17];        // Assuming column R stores State
  var country = responses[18];      // Assuming column S stores Country
  var pincode = responses[19];      // Assuming column T stores PinCode
  var additionalDescription = responses[20]; // Assuming column U stores Additional Description
  var leadID = responses[21];       // Assuming column V stores Lead ID

  // Generate the prefilled form link
  var prefilledLink = "https://docs.google.com/forms/d/e/1FAIpQLScOoleoqy7iakcsb7eUa8DLpEkw-ALndYdpo16LBZIdWfqbdw/viewform?usp=pp_url"
    + "&entry.382320733=" + encodeURIComponent(endUser)
    + "&entry.97376243=" + encodeURIComponent(firstName)
    + "&entry.461328421=" + encodeURIComponent(lastName)
    + "&entry.595395094=" + encodeURIComponent(company)
    + "&entry.159263935=" + encodeURIComponent(mobileNumber)
    + "&entry.288566598=" + encodeURIComponent(emailID)
    + "&entry.1830695020=" + encodeURIComponent(fax)
    + "&entry.1638620245=" + encodeURIComponent(website)
    + "&entry.1083761663=" + encodeURIComponent(leadSource)
    + "&entry.396867408=" + encodeURIComponent(leadStatus)
    + "&entry.1376066188=" + encodeURIComponent(industry)
    + "&entry.43979889=" + encodeURIComponent(numberOfEmployees)
    + "&entry.1989724413=" + encodeURIComponent(annualRevenue)
    + "&entry.1019765555=" + encodeURIComponent(socialMedia)
    + "&entry.1922882768=" + encodeURIComponent(description)
    + "&entry.2064231740=" + encodeURIComponent(street)
    + "&entry.1963491498=" + encodeURIComponent(city)
    + "&entry.1998507869=" + encodeURIComponent(state)
    + "&entry.1748437282=" + encodeURIComponent(country)
    + "&entry.369502378=" + encodeURIComponent(pincode)
    + "&entry.1066602877=" + encodeURIComponent(additionalDescription)
    + "&entry.832822168=" + encodeURIComponent(leadID);

  return prefilledLink;
}

function distributeAccountLevelData() {
  Logger.log('Starting the distributeAccountLevelData function.');
  
  var sourceSheetId = '1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8'; // ID of the Qualified Leads sheet
  var designatedFolderId = '14KwGob5YpqkzGY52frxC_iGvT2hD5tz9'; // Google Drive folder ID for distributed accounts

  var sourceSS = SpreadsheetApp.openById(sourceSheetId);
  var sourceSheet = sourceSS.getSheetByName('Qualified Leads'); // Adjust if the name is different
  
  var dataRange = sourceSheet.getDataRange();
  var data = dataRange.getValues();
  
  var accountsByUser = {};
  Logger.log('Fetched data from the source sheet.');

  // Group accounts by end user
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var endUser = row[0]; // Assuming the end user name is in column A (index 0)
    
    if (!accountsByUser[endUser]) {
      accountsByUser[endUser] = [];
    }
    accountsByUser[endUser].push(row);
  }
  Logger.log('Grouped accounts by user.');

  // Iterate through each end user to add accounts to the "Accounts" worksheet
  for (var user in accountsByUser) {
    Logger.log('Processing accounts for user: ' + user);
    
    var accounts = accountsByUser[user];
    
    // Try to find the user's existing file or create a new one
    var userSheetId = getOrCreateUserSheet(user, designatedFolderId);
    var userSheet = SpreadsheetApp.openById(userSheetId);
    
    // Check if the "Accounts" sheet exists, if not, create it
    var accountsSheet = userSheet.getSheetByName('Accounts');
    if (!accountsSheet) {
      accountsSheet = userSheet.insertSheet('Accounts'); // Create a new sheet named "Accounts"
      
      // Delete the default "Sheet1" if it exists
      var defaultSheet = userSheet.getSheetByName('Sheet1');
      if (defaultSheet) {
        userSheet.deleteSheet(defaultSheet);
        Logger.log('Deleted default "Sheet1" for user: ' + user);
      }
      
      // Add headers to the new Accounts sheet, including 'Timestamp'
      var headers = ['Timestamp', 'Lead Owner', 'First Name', 'Last Name', 'Company', 'Mobile Number', 'Email ID', 
                     'Fax', 'Website', 'Lead Source', 'Lead Status', 'Industry', 
                     'Number of Employees', 'Annual Revenue', 'Social Media', 
                     'Description', 'Street', 'City', 'State', 'Country', 
                     'PinCode', 'Additional Description', 'Lead ID', 'Prefilled Link'];
      accountsSheet.appendRow(headers); // Append headers to the Accounts sheet
      Logger.log('Created "Accounts" sheet and added headers for user: ' + user);
    }

    // Append qualified accounts to the accounts sheet
    for (var j = 0; j < accounts.length; j++) {
      var accountData = accounts[j];
      
      // Check if a timestamp is present in column AA (index 26) before transferring
      if (!accountData[26]) { // Column AA is index 26 (0-based index)
        accountsSheet.appendRow(accountData); // Append the account data
        Logger.log('Appended account data for user: ' + user);

        // Generate prefilled link for the current account
        var prefilledLink = generatePrefilledLink(accountData);
        var clickableLink = '=HYPERLINK("' + prefilledLink + '", "Create Deal")';

        // Set the clickable link in the last column (assuming it's the 24th column)
        accountsSheet.getRange(accountsSheet.getLastRow(), 24).setFormula(clickableLink); // Assuming column X (24th column)
        Logger.log('Added prefilled link for account for user: ' + user);
      } else {
        Logger.log('Skipping account for user: ' + user + ' as it has already been transferred.');
      }
    }

    Logger.log('Distributed accounts to: ' + user);
  }
  
  // Call the timestamp update function to store a timestamp in column AA for all accounts
  updateTimestampForAllAccounts(sourceSheet);
  Logger.log('Timestamp update completed for all accounts.');

  Logger.log('Exiting the distributeAccountLevelData function.');
}

// Helper function to get or create a user sheet in the designated folder
function getOrCreateUserSheet(userName, folderId) {
  Logger.log('Attempting to find or create a sheet for user: ' + userName);
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFilesByName(userName);
  
  if (files.hasNext()) {
    Logger.log('Found existing sheet for user: ' + userName);
    return files.next().getId(); // Return the ID of the existing file
  } else {
    // Create a new sheet for the user if not found
    Logger.log('No existing sheet found for user: ' + userName + '. Creating a new sheet.');
    var newUserSheet = SpreadsheetApp.create(userName);
    var newFile = DriveApp.getFileById(newUserSheet.getId());
    folder.addFile(newFile); // Add the file to the designated folder
    DriveApp.getRootFolder().removeFile(newFile); // Remove from root folder
    Logger.log('Created new sheet for user: ' + userName);
    return newUserSheet.getId();
  }
}

// Function to update the timestamp for all accounts in column AA (index 26)
function updateTimestampForAllAccounts(sheet) {
  Logger.log('Starting the updateTimestampForAllAccounts function.');
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();

  for (var i = 1; i < data.length; i++) {
    // Check if the account does not already have a timestamp in column AA
    if (!data[i][26]) { // Column AA is index 26 (0-based index)
      var timestamp = formatTimestamp(new Date());
      sheet.getRange(i + 1, 27).setValue(timestamp); // Update with formatted timestamp in column AA
      Logger.log('Timestamp updated for row ' + (i + 1));
    }
  }
  Logger.log('Completed timestamp update for all accounts.');
}

// Helper function to format timestamp in YYYYMMDDHHMMSSS format
function formatTimestamp(date) {
  var year = date.getFullYear();
  var month = ('0' + (date.getMonth() + 1)).slice(-2);
  var day = ('0' + date.getDate()).slice(-2);
  var hours = ('0' + date.getHours()).slice(-2);
  var minutes = ('0' + date.getMinutes()).slice(-2);
  var seconds = ('0' + date.getSeconds()).slice(-2);
  var milliseconds = ('00' + date.getMilliseconds()).slice(-3);

  return year + month + day + hours + minutes + seconds + milliseconds;
}



