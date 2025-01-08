**WHY - Vision & Purpose**

**1. Purpose & Users**

- Primary Problem Solved: Manual searching of product manuals and catalogs for product information is time-consuming, error-prone, and requires significant human resources

- Target Users: Industrial Sales Engineers, tech service professionals, new employees, other members in an organization that need to understand intricacies of product details quickly

- Value Proposition: A web application that ingests dense digital catalogs, using artificial intelligence, will provide users with a chatbot to prompt the system and gain desired product knowledge with high accuracy, reducing manual search time.

**WHAT - Core Requirements**

**2. Functional Requirements**

**Core Features**

System must:

- Have two components – an admin portal and client portal

- Allow admin to control client accounts by adding new clients, removing clients, selecting clients, and inputting catalogs for processing for each respective client

- Intake multiple large catalogs in PDF, Word, or Excel format containing tables, images, symbols, and graphs

- Parse and analyze the catalogs using indexing technologies known to RAG applications

- Allow clients to prompt their corresponding catalogs in natural language and obtain accurate responses

- Allow admin to customize client portals with respective brand guidelines, logos, and text fonts

- Have a testing capability throughout processing and parsing catalogs on the admin side, to assure accuracy in responses

- Be highly scalable

- Provide secure document storage and retrieval

- Have a strong foundation of databases and partition of client data

- Manage login credentials

**Admin Capabilities**

Admins must be able to:

- Login to the web application

- Interact with a dashboard of all clients

- Delete a client and it’s data

- Add a client which allows admin to:

- Enter corporate details such as name, address, industry, etc.

- Add branding guidelines to the client profile

- Input all client catalogs for processing

- Add how many seats/logins the client can have

- Edit a client's data

- Add a new catalog

- Delete a catalog

- Replace a catalog

- See all uploaded catalogs

- Edit all other client data

- Select a client

- When selecting a client, the admin will be able to see metrics on usage, entered prompts, and other key metrics

- Control amount of queries and usage client can prompt

**Client Capabilities**

Clients must be able to:

- Login to the web application

- Enter their required prompt in a chatbot using natural language

- Interact with the chatbot

- Create and delete chats/chatlogs

**HOW - Planning & Implementation**

**3. Technical Foundation**

**Required Stack Components**

- Frontend: React administrative and client interface

- Backend: RESTful API architecture

- Parsing Engine: Advanced OCR system using NVidia ingest

- Database: Structured storage for application data, preprocessed catalogs, vector embeddings, and graph embeddings

- Integration: Webhook management system

- Security: Credential management system

- AI/ML Integration: Utilize GPT-4o for LLM for NLP tasks

- Chatbot Framework: Utilize LLamaindex to power the chatbot and retrieval

- Hosting: Use Azure

**System Requirements**

- Admin Performance: Process and parse catalogs within 3 hours

- Client Performance: Receive answer to prompt as fast as possible

- Security: Encrypted storage, secure API access, audit logging

- Scalability: Handle thousands of catalog pages at a time

- Reliability: 99.9% uptime, 95%+ OCR accuracy

**4. User Experience**

**Admin User Flows**

 1. Login to the web application

 2. Entry: Enter Admin username, password

 3. Success: login to admin dashboard

 4. Failure: error message

 5. Add a client:

 6. Entry: Engage plus button

 7. Steps: Press ‘plus button’ -\> opens a modal -\> enter all corporate details -\> add (click ‘x button’ to leave modal -\> nothing is saved)

 8. Success: Client added to system

 9. Failure: error message

10. Edit a client's data

11. Entry: Click on a client in the dashboard

12. Steps: Click client on dashboard -\> client specific page pops up -\>

13. Add a new catalog -\> upload button -\> open modal -\> drag or select file to upload from computer -\> send uploaded document to be processed and parsed for corresponding client

14. Delete a catalog -\> click on specific catalog for a client -\> delete document button -\> removes specific catalog from all client data

15. Replace a catalog -\> click on specific catalog for a client -\> replace document button -\> open modal -\> drag/select 1 document from computer to replace with -\> process and parse new document -\> replace all instances of old document data with the new document data

16. Edit all other client data -\> allow admin to edit other data such as company details, branding, etc.

17. Select a client

18. Entry: Click on a client in the dashboard

19. Steps: Click client on dashboard -\> client specific page pops up -\>  admin will be able to see metrics on usage, entered prompts, and other key metric

20. Success: Client specific page is opened and corresponding data is shown

21. Failure: Error Message

22. Delete a client and it’s data

23. Entry: Click on a client in the dashboard

24. Steps: Click client on dashboard -\> press ‘delete client button’ -\> open popup to require admin to type in the word “DELETE” and hit enter -\> client gets deleted and removed from system

25. Success: Client is removed from system

26. Failure: Error Message

**Client User Flows**

 1. Login to the web application

 2. Entry: Enter client user username, password

 3. Success: login to client portal

 4. Failure: error message

 5. Interact with chatbot

 6. Entry: After login will be directly taken to chatbot

 7. Steps: Enter query -\> chatbot will get relevant content from catalogue and craft and return a informative and insightful reply to the query -\> user can enter a new query

 8. Success: User and chatbot messages are received and sent

 9. Failure: Error Message

10. Create a new chat

11. Entry: Click “plus button” to open a new chat

12. Steps: click “plus button” -\> new blank chat will pop up

13. Success: New empty chat is created

14. Failure: Error message

**Core Interfaces**

- Dashboard: Application overview, processing status, recent activities

- Application View: Extracted data, document previews, status information

- Webhook Management: Endpoint configuration, testing tools

- Settings: Email monitoring configuration, OCR parameters

- API Documentation: Interactive API documentation

**5. Business Requirements**

**Access Control**

- User Types: Administrators, Clients

- Authentication:  User credentials for UI

- Authorization: Role-based access control

**Business Rules**

- Data Validation: Verification of extracted data against expected formats

- Process Rules: Automatic flagging of credential missuses so one login credential cannot be used by many

- Service Levels: Maximum 1-minute processing time to answer a client query

**6. Implementation Priorities**

**High Priority (Must Have)**

- Advanced OCR processing engine

- AI/ML engines

- Natural language processing

- Structured data extraction and storage

- Unstructured data parsing and processing

- Secure data storage system

- REST API for data access

- Basic web interface for application review

- User friendly chatbot

**Medium Priority (Should Have)**

- Webhook integration system

- Benchmarking OCR engines on accuracy and employing highest accuracy

- Batch processing capabilities

**Lower Priority (Nice to Have)**

- Advanced analytics dashboard

- Bulk data export features