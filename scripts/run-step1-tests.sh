#!/bin/bash

echo "🧪 Running Enhanced Cart Data Structure Tests (Step 1)"
echo "======================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if tsx is available
if ! command -v tsx &> /dev/null; then
    echo -e "${RED}❌ tsx is not installed. Installing...${NC}"
    npm install -g tsx
fi

# Check if development server is running
echo -e "${BLUE}🔍 Checking if development server is running...${NC}"
if curl -s http://localhost:3000/api/admin/countries?supportedOnly=true > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Development server is running${NC}"
    SERVER_RUNNING=true
else
    echo -e "${RED}⚠️  Development server is not running on localhost:3000${NC}"
    echo "Please start the server with: npm run dev"
    SERVER_RUNNING=false
fi

echo ""

# Test 1: Data Structure Test (doesn't require running server)
echo -e "${BLUE}🧪 Running Test 1: Enhanced Cart Data Structure Test${NC}"
echo "---------------------------------------------------"

if cd "$(dirname "$0")" && tsx test-enhanced-cart.ts; then
    echo -e "${GREEN}✅ Test 1 PASSED: Data structure test successful${NC}"
    TEST1_PASSED=true
else
    echo -e "${RED}❌ Test 1 FAILED: Data structure test failed${NC}"
    TEST1_PASSED=false
fi

echo ""

# Test 2: API Integration Test (requires running server)
echo -e "${BLUE}🧪 Running Test 2: API Integration Test${NC}"
echo "-------------------------------------"

if [ "$SERVER_RUNNING" = true ]; then
    if tsx test-cart-api-integration.ts; then
        echo -e "${GREEN}✅ Test 2 PASSED: API integration test successful${NC}"
        TEST2_PASSED=true
    else
        echo -e "${RED}❌ Test 2 FAILED: API integration test failed${NC}"
        TEST2_PASSED=false
    fi
else
    echo -e "${RED}❌ Test 2 SKIPPED: Development server not running${NC}"
    TEST2_PASSED=false
fi

echo ""
echo "🏆 FINAL RESULTS"
echo "================"

if [ "$TEST1_PASSED" = true ]; then
    echo -e "✅ Data Structure Test: ${GREEN}PASSED${NC}"
else
    echo -e "❌ Data Structure Test: ${RED}FAILED${NC}"
fi

if [ "$SERVER_RUNNING" = true ]; then
    if [ "$TEST2_PASSED" = true ]; then
        echo -e "✅ API Integration Test: ${GREEN}PASSED${NC}"
    else
        echo -e "❌ API Integration Test: ${RED}FAILED${NC}"
    fi
else
    echo -e "⚠️  API Integration Test: ${RED}SKIPPED${NC} (server not running)"
fi

echo ""

if [ "$TEST1_PASSED" = true ] && ([ "$TEST2_PASSED" = true ] || [ "$SERVER_RUNNING" = false ]); then
    echo -e "${GREEN}🎉 Step 1: Enhanced Cart Data Structure is WORKING!${NC}"
    echo -e "${GREEN}✅ Ready to proceed to Step 2: Pre-checkout validation${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Step 1 has issues that need to be fixed${NC}"
    echo -e "${RED}❌ Please resolve the failed tests before proceeding${NC}"
    exit 1
fi