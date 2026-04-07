# AI Council Prompt #4 — Find REAL Existing Payroll & Bank Slip Documents

> Send to: Gemini, ChatGPT, Grok, Perplexity (Perplexity is best for finding actual URLs)
> Save responses to `research/findings/{ai_name}_real_docs_response.md`

**IMPORTANT:** I do NOT want generated/fabricated data. I want links to REAL EXISTING documents on the internet.

---

## The Prompt

```
I need you to find REAL, EXISTING documents on the internet — NOT generate new ones.

I'm looking for images (PNG, JPG) or PDFs of ACTUAL payroll documents, salary sheets, bank payment instructions, and bank deposit slips that contain FILLED-IN employee data tables.

Here are 2 examples of what I already have (to show you exactly what format I need):

EXAMPLE 1 — Bank Slip / Payroll Summary:
- Header: Company name, payroll period, total amount, funding account, currency, payment method
- Small table: 4-5 rows with employee data (Name, Account/Reference, Amount)
- Footer: Authorized signature

EXAMPLE 2 — Payroll Instruction: 
- Header: Company name, address, contact person, payroll period
- Summary: Total Net Salary, Total Fee, Funding Amount
- Table: Employee rows with name, account/reference
- Footer: Signature, date

I need MORE documents like these — real ones that exist on the internet. They can be from any country, any bank, any company.

### WHERE TO SEARCH

Please search these specific locations and give me DIRECT DOWNLOAD LINKS:

**1. Scribd (highest priority — has many real uploaded documents)**
Search on scribd.com for:
- "salary transfer list" 
- "payroll sheet filled"
- "employee salary list"
- "bulk payment instruction"
- "salary disbursement list"
- "bank salary transfer"
- "payroll register filled"
- "wage sheet employees"
Give me the Scribd document URLs.

**2. SlideShare**
Search slideshare.net for:
- "payroll template sample"
- "salary sheet example"
- "employee payment list"

**3. DocPlayer**
Search docplayer.net for:
- "payroll register"
- "salary disbursement"
- "bank payment instruction"

**4. Google Images — specifically looking for screenshots of filled spreadsheets**
Search Google Images for:
- "salary sheet with employee names filled" -template -blank
- "payroll register filled example data"
- "bank salary transfer list employees"
- "payment instruction employee list filled"
- "wage payment sheet with data"
- "employee salary disbursement list image"
- "bulk payment file sample data"
- "payroll spreadsheet screenshot filled"
- site:pinterest.com "payroll sheet" OR "salary sheet"

**5. Government/Public payroll records**
- US WH-347 certified payroll examples (some are public records)
- Search: "certified payroll report sample filled" filetype:pdf
- Search: "prevailing wage payroll example" 
- Search: site:gov "payroll" "employee" filetype:pdf

**6. Accounting/Bookkeeping sites with samples**
- Search: site:exceldatapro.com salary OR payroll
- Search: site:exceltmp.com payroll sample
- Search: site:wallstreetmojo.com payroll template example
- Search: site:corporatefinanceinstitute.com payroll
- Search: site:freshbooks.com payroll

**7. Sample data repositories**
- Search: site:kaggle.com payroll employee data
- Search: site:github.com "payroll" "csv" sample
- Search: site:data.world payroll OR salary

### WHAT I NEED FROM EACH RESULT

For EVERY link you find, tell me:
1. **Direct URL** (clickable, not "search for X on Y")
2. **What it is** (payroll register? salary sheet? bank transfer list? deposit slip?)
3. **Number of employee rows** visible (e.g., "12 employees with names and amounts")
4. **Columns present** (Name? Phone? Account Number? Amount? ID/NRC? Deductions?)
5. **File type** (PNG, JPG, PDF, XLSX)
6. **Free or login required?**

### WHAT MAKES A DOCUMENT USEFUL FOR ME

MUST HAVE (at minimum):
- A table with MULTIPLE employee rows (not just 1 employee)
- Employee NAME column
- AMOUNT/SALARY column
- Some kind of employee IDENTIFIER (phone, account number, employee ID)

NICE TO HAVE:
- Company header section
- Total/sum row
- Signature/approval section
- Date/period information
- Bank account numbers or phone numbers

NOT USEFUL:
- Blank templates with no data
- Single-employee pay stubs
- Marketing/promotional images
- Templates you need to buy

### QUANTITY

I need at least 10-15 links. Cast a wide net. Different formats, different countries, different layouts — the variety is important because I'm testing whether my AI can extract data from ANY payroll format, not just one specific template.
```

---

## After Getting Responses

1. Test each link — does it load? Is it a real document with employee data?
2. Download working files to `research/real_samples/internet_samples/`
3. Name files descriptively: `{source}_{type}_{emp_count}.{ext}`
   Example: `scribd_salary_transfer_7emp.png`, `gov_wh347_certified_6emp.pdf`
4. Delete any files that turn out to be blank templates or marketing images
