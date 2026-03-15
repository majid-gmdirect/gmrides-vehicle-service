# GMRides User Service - Comprehensive Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Authentication & Authorization](#authentication--authorization)
5. [API Endpoints](#api-endpoints)
6. [Core Services](#core-services)
7. [Security Features](#security-features)
8. [Integration Points](#integration-points)
9. [Message Queue Integration](#message-queue-integration)
10. [Configuration](#configuration)
11. [Deployment](#deployment)

---

## Overview

The **GMRides User Service** is a dedicated microservice responsible for managing user profiles, customer information, driver details, and user-related data in the GMRides platform. It serves as the central user management hub, handling user CRUD operations, role management, profile management, and integration with other services.

### Key Responsibilities
- User profile management (CRUD operations)
- Customer profile management
- Driver profile management (including licenses)
- Role-based access control
- User search and filtering
- Email verification status management
- Account status management (blocked, deleted, approved)
- Integration with external services (upload service, notification service)
- Message queue integration (RabbitMQ)

### Technology Stack
- **Framework**: NestJS 11.x
- **Database**: PostgreSQL (via Prisma ORM)
- **Message Queue**: RabbitMQ (via @nestjs/microservices)
- **JWT**: RS256 asymmetric encryption (public key verification)
- **HTTP Client**: Axios for service-to-service communication

---

## Architecture

### Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   User Service                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                │
│  │   User       │    │   Customer   │                │
│  │   Module     │    │   Module     │                │
│  └──────────────┘    └──────────────┘                │
│         │                    │                        │
│         └──────────┬──────────┘                        │
│                    │                                   │
│  ┌─────────────────▼──────────┐                       │
│  │      Driver Module          │                       │
│  └─────────────────────────────┘                       │
│         │                                              │
│         ├──────────────┐                              │
│         │              │                              │
│  ┌──────▼──────┐  ┌───▼────────┐                   │
│  │   Auth      │  │   Prisma   │                   │
│  │   Module    │  │   Module   │                   │
│  └─────────────┘  └─────────────┘                   │
│         │                                              │
│         └──────────────┐                              │
│                        │                              │
│  ┌─────────────────────▼──────────┐                 │
│  │   RabbitMQ (Message Queue)     │                 │
│  │   - Notification Service        │                 │
│  │   - Search Service              │                 │
│  │   - Task Service                │                 │
│  └─────────────────────────────────┘                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
         │
         │ HTTP/REST
         │
┌────────▼──────────────────────────────────────────────┐
│         Auth Service (External)                         │
│   (User creation, email updates, verification)          │
└───────────────────────────────────────────────────────┘
```

### Module Structure

The service is organized into the following modules:

1. **UserModule**: Core user profile management
2. **CustomerModule**: Customer-specific profile management
3. **DriverModule**: Driver-specific profile management (licenses, PCO licenses)
4. **AuthModule**: JWT verification and role-based access control
5. **PrismaModule**: Database access layer

### Global Guards

The service uses global guards for all routes:

1. **JwtAuthGuard**: Validates JWT tokens (applied globally)
2. **RolesGuard**: Enforces role-based access control (applied globally)

Routes can opt-out using the `@Public()` decorator.

---

## Database Schema

### User Model

```prisma
model User {
  id         String   @id @default(uuid())
  email      String   @unique
  first_name String?
  last_name  String?
  role       UserRole @default(CUSTOMER)
  bio        String?
  phone      String?
  avatar     Json?    // { id: string, url: string }
  isBlocked  Boolean  @default(false)
  isVerified Boolean  @default(false)
  isDeleted  Boolean? @default(false)
  isApproved Boolean  @default(false)

  driver     Driver?
  customer   Customer?
  
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Key Fields:**
- `id`: Unique UUID identifier (matches Auth Service user ID)
- `email`: Unique email address
- `role`: UserRole enum (ADMIN, CUSTOMER, DRIVER)
- `avatar`: JSON object with file ID and URL
- `isBlocked`: Account blocking status
- `isVerified`: Email verification status
- `isDeleted`: Soft delete flag
- `isApproved`: Approval status (for drivers)

**Relationships:**
- One-to-one with `Customer` (if role is CUSTOMER)
- One-to-one with `Driver` (if role is DRIVER)

### Customer Model

```prisma
model Customer {
  userId String @id
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  address_line_one String?
  address_line_two String?
  city           String?
  state          String?
  zipCode        String?
  latitude       Float?
  longitude      Float?
}
```

**Key Features:**
- One-to-one relationship with User
- Cascade delete (deleted when user is deleted)
- Address information for location-based services
- Geographic coordinates (latitude/longitude)

### Driver Model

```prisma
model Driver {
  userId String @id
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  whatsapp      String?
  address_line_one String?
  address_line_two String?
  city           String?
  state          String?
  zipCode        String?
  latitude       Float?
  longitude      Float?
  national_insurance_num  String?
  birthDate     DateTime?
  title         String?
  payment_info  Json?    // Payment method information

  licenses          DriverLicense[]
  pco_licenses      DriverPcoLicense[]
}
```

**Key Features:**
- One-to-one relationship with User
- Multiple driver licenses (one-to-many)
- Multiple PCO licenses (one-to-many)
- Payment information stored as JSON
- National insurance number for UK drivers

### DriverLicense Model

```prisma
model DriverLicense {
  id           String   @id @default(uuid())
  license_num  String
  issue_date   DateTime
  expiry_date  DateTime
  front_image  Json?    // { id: string, url: string }
  back_image   Json?    // { id: string, url: string }
  dvla_doc     Json?    // DVLA document information
  isActive     Boolean  @default(true)

  driver_id    String
  driver       Driver   @relation(fields: [driver_id], references: [userId], onDelete: Cascade)

  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
}
```

**Key Features:**
- Multiple licenses per driver
- Image storage for front and back of license
- DVLA document support
- Active/inactive status
- Expiry date tracking

### DriverPcoLicense Model

```prisma
model DriverPcoLicense {
  id               String   @id @default(uuid())
  license_num      String
  badge_number     String
  issue_date       DateTime
  expiry_date      DateTime
  image            Json?    // { id: string, url: string }
  pco_badge_front  Json?    // { id: string, url: string }
  pco_badge_back   Json?    // { id: string, url: string }
  isActive         Boolean  @default(true)

  driver_id        String
  driver           Driver   @relation(fields: [driver_id], references: [userId], onDelete: Cascade)

  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
}
```

**Key Features:**
- PCO (Private Hire Operator) license for UK
- Badge number tracking
- Multiple badge images (front/back)
- Active/inactive status
- Expiry date tracking

### Enums

```prisma
enum UserRole {
  ADMIN
  CUSTOMER
  DRIVER
}

enum ReviewerRole {
  CUSTOMER
  DRIVER
}
```

---

## Authentication & Authorization

### JWT Verification

The service uses **RS256** (RSA with SHA-256) asymmetric encryption for JWT token verification.

#### Token Verification

The service verifies tokens signed by the Auth Service:

```typescript
// JWT Strategy Configuration
{
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: publicKey (from keys/public.pem),
  algorithms: ['RS256']
}
```

**Key Management:**
- Public key: Used for verification (from `keys/public.pem`)
- Must match the private key used by Auth Service
- Location: `keys/public.pem`
- Shared from Auth Service

#### JWT Payload Structure

```typescript
{
  sub: string,      // User ID
  email: string,    // User email
  role: UserRole    // User role (ADMIN, CUSTOMER, DRIVER)
}
```

After validation, the payload is transformed to:

```typescript
{
  userId: string,   // From payload.sub
  email: string,    // From payload.email
  role: string      // From payload.role
}
```

### Role-Based Access Control (RBAC)

The service implements comprehensive RBAC:

**Roles:**
- `ADMIN`: Full access to all resources
- `CUSTOMER`: Access to own profile and customer-specific resources
- `DRIVER`: Access to own profile and driver-specific resources

**Access Control Patterns:**

1. **Owner Access**: Users can access/modify their own resources
2. **Admin Access**: Admins can access/modify any resource
3. **Role-Specific Access**: Some endpoints are role-specific

**Implementation:**
- Global `RolesGuard` applied to all routes
- `@Roles()` decorator specifies required roles
- `@Public()` decorator opts out of authentication
- `@InternalRoute()` decorator for internal API endpoints

### Internal API Protection

Internal endpoints are protected by `InternalApiGuard`:

- Validates `Authorization: Bearer {INTERNAL_API_KEY}` header
- Used for service-to-service communication
- Prevents unauthorized access to internal endpoints

---

## API Endpoints

### User Endpoints

#### 1. Create User Profile (Internal)
```
POST /api/users/main/internal/create-user-profile
Authorization: Bearer {INTERNAL_API_KEY}
```

**Access**: Internal API only

**Request Body:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "CUSTOMER" | "DRIVER" | "ADMIN",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "CUSTOMER",
  ...
}
```

**Flow:**
1. Verify internal API key
2. Check if profile already exists
3. Validate role
4. Create user profile
5. Return created user

**Called By**: Auth Service during registration

#### 2. Get All Users
```
GET /api/users/main?search=john&page=1&limit=10&orderBy=desc&role=CUSTOMER
Authorization: Bearer {admin_token}
```

**Access**: ADMIN only

**Query Parameters:**
- `search`: Search in email and first_name (optional)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `orderBy`: Sort order - 'asc' or 'desc' (default: 'desc')
- `role`: Filter by role (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "user@example.com",
      "role": "CUSTOMER",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "paginationMeta": {
    "total": 100,
    "page": 1,
    "limit": 10
  },
  "message": "List fetched successfully"
}
```

**Features:**
- Pagination support
- Search functionality
- Role filtering
- Soft-deleted users excluded

#### 3. Get User by ID
```
GET /api/users/main/:id
Authorization: Bearer {access_token}
```

**Access**: Owner or ADMIN

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "email": "user@example.com",
    "bio": "User bio",
    "phone": "+1234567890",
    "role": "CUSTOMER",
    "avatar": { "id": "file-id", "url": "https://..." },
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "User retrieved successfully"
}
```

**Access Control:**
- Users can view their own profile
- Admins can view any profile
- Others receive 403 Forbidden

#### 4. Update User
```
PATCH /api/users/main/:id
Authorization: Bearer {access_token}
```

**Access**: Owner or ADMIN

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "bio": "Updated bio",
  "phone": "+1234567890",
  "avatar": { "id": "new-file-id", "url": "https://..." }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "first_name": "John",
    ...
  },
  "message": "User updated successfully"
}
```

**Special Features:**
- **Avatar Management**: Automatically deletes old avatar from Upload Service when changed
- **Access Control**: Owner or admin can update

**Flow:**
1. Verify user exists and permissions
2. If avatar changed, delete old avatar from Upload Service
3. Update user profile
4. Return updated user

#### 5. Delete User
```
DELETE /api/users/main/:id
Authorization: Bearer {access_token}
```

**Access**: Owner or ADMIN

**Response:**
```json
{
  "success": true,
  "message": "User deleted permanently"
}
```

**Flow:**
1. Verify user exists and permissions
2. Delete user from User Service database
3. Call Auth Service to delete user from Auth database
4. Return success

**Note**: This is a hard delete (not soft delete)

#### 6. Update User Role
```
PATCH /api/users/main/:id/role
Authorization: Bearer {admin_token}
```

**Access**: ADMIN only

**Request Body:**
```json
{
  "role": "DRIVER"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "role": "DRIVER"
  },
  "message": "User role updated successfully"
}
```

#### 7. Get User Role by ID (Internal)
```
GET /api/users/main/role-by-id/:id
Authorization: Bearer {INTERNAL_API_KEY}
```

**Access**: Internal API only

**Response:**
```json
{
  "role": "CUSTOMER",
  "isVerified": true,
  "isDeleted": false,
  "isBlocked": false
}
```

**Called By**: Auth Service during login/refresh token

#### 8. Update User Email (Internal)
```
POST /api/users/main/internal/update-user-email
Authorization: Bearer {INTERNAL_API_KEY}
```

**Access**: Internal API only

**Request Body:**
```json
{
  "userId": "uuid",
  "email": "newemail@example.com"
}
```

**Called By**: Auth Service when email is changed

#### 9. Verify Email (Internal)
```
GET /api/users/main/internal/verify-email/:id
Authorization: Bearer {INTERNAL_API_KEY}
```

**Access**: Internal API only

**Response:**
```json
{
  "isVerified": true
}
```

**Flow:**
1. Find user by ID
2. Update `isVerified` to `true`
3. Return verification status

**Called By**: Auth Service when email is verified

#### 10. Get Users by IDs (Internal)
```
POST /api/users/main/batch
Authorization: Bearer {INTERNAL_API_KEY}
```

**Access**: Internal API only

**Request Body:**
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
[
  {
    "id": "uuid1",
    "first_name": "John",
    "last_name": "Doe",
    "email": "user@example.com",
    "avatar": { "id": "file-id", "url": "https://..." }
  }
]
```

**Use Case**: Batch user lookup for recommendations or listings

#### 11. Find Recommends (Internal)
```
POST /api/users/main/internal/recommends
Authorization: Bearer {INTERNAL_API_KEY}
```

**Access**: Internal API only

**Request Body:**
```json
{
  "proIds": ["uuid1", "uuid2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid1",
      "first_name": "John",
      "last_name": "Doe",
      "email": "driver@example.com",
      "role": "DRIVER",
      "avatar": { "id": "file-id", "url": "https://..." }
    }
  ],
  "message": "Pro users fetched successfully"
}
```

**Features:**
- Filters by DRIVER role
- Excludes soft-deleted users
- Returns limited fields for recommendations

#### 12. Get Profile (Internal)
```
GET /api/users/main/profile/:id
Authorization: Bearer {INTERNAL_API_KEY}
```

**Access**: Internal API only

**Response:**
```json
{
  "id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "email": "user@example.com",
  "role": "CUSTOMER",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Customer Endpoints

#### 13. Create Customer Profile
```
POST /api/users/customers
Authorization: Bearer {access_token}
```

**Access**: Authenticated users

**Request Body:**
```json
{
  "address_line_one": "123 Main St",
  "address_line_two": "Apt 4B",
  "city": "London",
  "state": "England",
  "zipCode": "SW1A 1AA",
  "latitude": 51.5074,
  "longitude": -0.1278
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "address_line_one": "123 Main St",
    ...
  },
  "message": "Customer profile created"
}
```

**Requirements:**
- User must exist
- User role should be CUSTOMER
- Profile must not already exist

#### 14. Get Customer Profile
```
GET /api/users/customers/:id
Authorization: Bearer {access_token}
```

**Access**: Owner, ADMIN, or limited data for others

**Response (Owner/Admin):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "address_line_one": "123 Main St",
    "address_line_two": "Apt 4B",
    "city": "London",
    "state": "England",
    "zipCode": "SW1A 1AA",
    "latitude": 51.5074,
    "longitude": -0.1278
  },
  "message": "Customer retrieved successfully"
}
```

**Response (Others):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "address_line_one": "123 Main St",
    "city": "London"
  },
  "message": "Customer retrieved successfully"
}
```

**Privacy**: Non-owners/admins receive limited address information

#### 15. Update Customer Profile
```
PATCH /api/users/customers/:id
Authorization: Bearer {access_token}
```

**Access**: Owner only

**Request Body:**
```json
{
  "address_line_one": "456 New St",
  "city": "Manchester"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "address_line_one": "456 New St",
    ...
  },
  "message": "Customer profile updated"
}
```

#### 16. Delete Customer Profile
```
DELETE /api/users/customers/:id
Authorization: Bearer {access_token}
```

**Access**: Owner or ADMIN

**Response:**
```json
{
  "success": true,
  "message": "Customer profile deleted"
}
```

### Driver Endpoints

#### 17. Create Driver Profile
```
POST /api/users/drivers
Authorization: Bearer {access_token}
```

**Access**: Authenticated users

**Request Body:**
```json
{
  "whatsapp": "+1234567890",
  "address_line_one": "123 Main St",
  "city": "London",
  "national_insurance_num": "AB123456C",
  "birthDate": "1990-01-01",
  "title": "Mr"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "whatsapp": "+1234567890",
    ...
  },
  "message": "Driver profile created"
}
```

#### 18. Get Driver Profile
```
GET /api/users/drivers/:id
Authorization: Bearer {access_token}
```

**Access**: Authenticated users

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "whatsapp": "+1234567890",
    "address_line_one": "123 Main St",
    "licenses": [...],
    "pco_licenses": [...]
  },
  "message": "Driver retrieved successfully"
}
```

#### 19. Update Driver Profile
```
PATCH /api/users/drivers/:id
Authorization: Bearer {access_token}
```

**Access**: Owner only

**Request Body:**
```json
{
  "whatsapp": "+9876543210",
  "city": "Manchester"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "whatsapp": "+9876543210",
    ...
  },
  "message": "Driver profile updated"
}
```

#### 20. Delete Driver Profile
```
DELETE /api/users/drivers/:id
Authorization: Bearer {access_token}
```

**Access**: Owner or ADMIN

**Response:**
```json
{
  "success": true,
  "message": "Driver profile deleted"
}
```

---

## Core Services

### UserService

**Location**: `src/user/user.service.ts`

**Responsibilities:**
- User profile CRUD operations
- User search and filtering
- Role management
- Email verification management
- Batch user operations

**Key Methods:**
- `createUserProfile(dto)`: Create user profile (internal)
- `findAll(query)`: Get paginated user list with search
- `findOne(id, requester)`: Get user by ID with access control
- `update(id, dto, requester)`: Update user profile
- `remove(id, requester)`: Delete user (hard delete)
- `getRoleById(id)`: Get user role and status (internal)
- `updateRole(id, dto)`: Update user role (admin only)
- `updateUserEmail(dto)`: Update user email (internal)
- `verifyEmail(id)`: Mark email as verified (internal)
- `findManyByIds(ids)`: Batch user lookup (internal)
- `findRecommends(proIds)`: Get driver recommendations (internal)
- `findProfile(id)`: Get user profile (internal)

**Dependencies:**
- PrismaService (database)
- HttpService (external service communication)
- NotificationClient (RabbitMQ - optional)

### CustomerService

**Location**: `src/customer/customer.service.ts`

**Responsibilities:**
- Customer profile management
- Address information management
- Privacy-aware data access

**Key Methods:**
- `createCustomerProfile(userId, dto)`: Create customer profile
- `getCustomerProfile(id, requester)`: Get customer profile with privacy controls
- `updateCustomerProfile(userId, dto, requester)`: Update customer profile
- `deleteCustomerProfile(userId, requester)`: Delete customer profile
- `getCustomerByIds(ids)`: Batch customer lookup

**Privacy Features:**
- Owners and admins see full profile
- Others see limited address information

### DriverService

**Location**: `src/driver/driver.service.ts`

**Responsibilities:**
- Driver profile management
- License management (via relationships)
- PCO license management

**Key Methods:**
- `createDriverProfile(userId, dto)`: Create driver profile
- `getDriverProfile(id, requester)`: Get driver profile
- `updateDriverProfile(userId, dto, requester)`: Update driver profile
- `deleteDriverProfile(userId, requester)`: Delete driver profile
- `getDriverByIds(ids)`: Batch driver lookup

**Dependencies:**
- PrismaService (database)
- SearchClient (RabbitMQ - optional)
- TaskClient (RabbitMQ - optional)
- HttpService (external service communication)

---

## Security Features

### 1. JWT Authentication
- **Algorithm**: RS256 (asymmetric encryption)
- **Public Key Verification**: Verifies tokens signed by Auth Service
- **Global Guard**: All routes protected by default
- **Public Routes**: Opt-out using `@Public()` decorator

### 2. Role-Based Access Control
- **Global RolesGuard**: Applied to all routes
- **Role Validation**: Checks user role from JWT payload
- **Owner Access**: Users can access their own resources
- **Admin Override**: Admins can access any resource

### 3. Internal API Protection
- **InternalApiGuard**: Protects internal endpoints
- **API Key Validation**: Validates `INTERNAL_API_KEY`
- **Service-to-Service**: Secure communication between services

### 4. Data Privacy
- **Customer Data**: Limited access for non-owners
- **Soft Delete**: `isDeleted` flag prevents access
- **Account Status**: Blocked/unverified accounts handled

### 5. Input Validation
- **DTO Validation**: All inputs validated using class-validator
- **Whitelist**: Only allowed properties accepted
- **Type Transformation**: Automatic type conversion

### 6. File Management
- **Avatar Cleanup**: Automatically deletes old avatars
- **Upload Service Integration**: Secure file deletion

---

## Integration Points

### Auth Service Integration

The User Service receives calls from the Auth Service:

1. **Profile Creation**: After user registration
   - Called by: Auth Service
   - Endpoint: `POST /api/users/main/internal/create-user-profile`
   - Authentication: `INTERNAL_API_KEY`

2. **Email Update**: When email is changed
   - Called by: Auth Service
   - Endpoint: `POST /api/users/main/internal/update-user-email`
   - Authentication: `INTERNAL_API_KEY`

3. **Email Verification**: When email is verified
   - Called by: Auth Service
   - Endpoint: `GET /api/users/main/internal/verify-email/:id`
   - Authentication: `INTERNAL_API_KEY`

4. **Role Retrieval**: During login/refresh
   - Called by: Auth Service
   - Endpoint: `GET /api/users/main/role-by-id/:id`
   - Response: `{ role, isVerified, isDeleted, isBlocked }`
   - Authentication: `INTERNAL_API_KEY`

### Upload Service Integration

The User Service communicates with the Upload Service:

1. **Avatar Deletion**: When avatar is updated
   - Endpoint: `DELETE /api/uploads/delete-internal/:fileId`
   - Authentication: `INTERNAL_API_KEY`
   - Called when: User updates avatar

**Error Handling:**
- Logs warning if deletion fails (non-blocking)
- Continues with update even if old avatar deletion fails

### External Service Communication

**HTTP Client**: Uses `@nestjs/axios` (HttpService)

**Pattern:**
```typescript
await lastValueFrom(
  this.httpService.delete(url, {
    headers: {
      Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
    },
  }),
);
```

---

## Message Queue Integration

### RabbitMQ Configuration

The service integrates with RabbitMQ for asynchronous communication:

```typescript
{
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBIT_MQ_URL || 'amqp://localhost:5672'],
    queue: 'user_queue',
    queueOptions: { durable: true },
  },
}
```

### Microservice Clients

The service injects microservice clients for:

1. **Notification Service** (`NOTIFICATION_SERVICE`)
   - Purpose: Send notifications
   - Usage: (Currently commented out in code)

2. **Search Service** (`SEARCH_SERVICE`)
   - Purpose: Search functionality
   - Usage: (Available in DriverService)

3. **Task Service** (`TASK_SERVICE`)
   - Purpose: Task management
   - Usage: (Available in DriverService)

**Note**: These clients are configured but may not be actively used in all scenarios.

---

## Configuration

### Environment Variables

```env
# Server Configuration
PORT=4002
ENABLE_SWAGGER=true

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gmrides_user

# JWT Public Key
# Public key is stored in keys/public.pem
# Must match Auth Service's private key

# External Services
BASE_API_URL=http://localhost:4001
INTERNAL_API_KEY=your_internal_api_key_here

# Message Queue
RABBIT_MQ_URL=amqp://localhost:5672
```

### CORS Configuration

```typescript
{
  origin: [
    'http://localhost:3000',
    'https://one-stop-admin-panel.vercel.app',
    'https://one-stop-website.vercel.app',
    'https://panel.onestoppros.us',
    'https://onestoppros.us',
  ],
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
}
```

### Swagger Configuration

- **Enabled**: When `ENABLE_SWAGGER=true`
- **Path**: `/api/users/swagger`
- **Bearer Auth**: Configured for testing authenticated endpoints

### Global Guards Configuration

```typescript
providers: [
  {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,  // Applied globally
  },
  {
    provide: APP_GUARD,
    useClass: RolesGuard,    // Applied globally
  },
]
```

**Opt-out Decorators:**
- `@Public()`: Bypass JWT authentication
- `@InternalRoute()`: Use InternalApiGuard instead

---

## Deployment

### Prerequisites

1. **Node.js**: v18+ or v20+
2. **PostgreSQL**: v12+
3. **RabbitMQ**: v3.8+ (optional, for message queue)
4. **Environment Variables**: All required variables set
5. **Public Key**: `keys/public.pem` from Auth Service

### Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Copy Public Key**
   ```bash
   # Copy public key from Auth Service
   cp ../gmrides-auth-service/keys/public.pem keys/public.pem
   ```

3. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npx prisma seed  # Optional
   ```

4. **Start RabbitMQ** (if using message queue)
   ```bash
   docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management
   ```

5. **Run Application**
   ```bash
   # Development
   npm run start:dev

   # Production
   npm run build
   npm run start:prod
   ```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4002
CMD ["npm", "run", "start:prod"]
```

### Health Checks

The service doesn't have a dedicated health check endpoint, but you can verify:
- Database connection: Check Prisma connection
- Message queue connection: Check RabbitMQ connection
- Service availability: `GET /api/users/main/:id` (requires auth)

---

## Error Handling

### Standard Error Responses

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

### Common Error Codes

- `400 Bad Request`: Invalid input, validation errors
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side errors

### Response Format

Successful responses use a standard format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "paginationMeta": { ... }  // For paginated responses
}
```

---

## Best Practices

### Security
1. **Never expose internal API keys** in client-side code
2. **Validate all inputs** using DTOs
3. **Implement rate limiting** on public endpoints
4. **Monitor failed authentication attempts**
5. **Regular security audits** of dependencies

### Performance
1. **Use database indexes** on frequently queried fields
2. **Implement pagination** for list endpoints
3. **Cache frequently accessed data** where appropriate
4. **Optimize database queries** with proper select statements
5. **Monitor database performance**

### Reliability
1. **Use transactions** for multi-step operations
2. **Handle external service failures** gracefully
3. **Implement retry logic** for critical operations
4. **Monitor service health** and dependencies
5. **Log important operations** for debugging

### Data Privacy
1. **Respect privacy settings** in customer data access
2. **Implement soft deletes** where appropriate
3. **Audit data access** for compliance
4. **Handle PII (Personally Identifiable Information)** carefully

---

## Troubleshooting

### Common Issues

1. **"Missing public key" error**
   - Solution: Copy `keys/public.pem` from Auth Service

2. **Database connection errors**
   - Solution: Verify `DATABASE_URL` and database is accessible

3. **JWT verification failures**
   - Solution: Ensure public key matches Auth Service's private key

4. **Internal API key errors**
   - Solution: Verify `INTERNAL_API_KEY` matches Auth Service configuration

5. **RabbitMQ connection errors**
   - Solution: Verify `RABBIT_MQ_URL` and RabbitMQ is running

6. **Upload Service communication failures**
   - Solution: Verify `BASE_API_URL` and Upload Service is accessible

---

## API Versioning

Currently, the service uses a single API version. Future versions should be implemented as:
- `/api/v1/users/...` for version 1
- `/api/v2/users/...` for version 2

---

## Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test:cov
```

---

## License

UNLICENSED - Private project

---

## Support

For issues or questions, contact the development team.
