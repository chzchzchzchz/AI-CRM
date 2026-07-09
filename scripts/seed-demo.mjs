#!/usr/bin/env node
/**
 * seed-demo.mjs — (re)generate the rich, realistic demo dataset so the DEMO_MODE
 * dashboard looks like a real RevOps cockpit (closes demos better than 3 toy accounts).
 *
 * Writes the version-controlled seed (demo-db.seed.json) AND the runtime copy
 * (demo-db.json). Only accounts / contacts / calls / opportunities are regenerated;
 * users and auth records are preserved. All data here is 100% synthetic.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";

const SEED = "./demo-db.seed.json";
const DB = "./demo-db.json";

// Source of truth is the seed; fall back to an empty skeleton on a fresh checkout.
const base = existsSync(SEED) ? SEED : (existsSync(DB) ? DB : null);
const db = base
  ? JSON.parse(readFileSync(base, "utf8"))
  : { users: [], access_requests: [], accounts: [], contacts: [], calls: [],
      opportunities: [], contextStore: [], auditLogs: [],
      email_verification_codes: [], password_reset_codes: [] };

const now = new Date().toISOString();
const iso = (d) => new Date(d).toISOString();
const J = (a) => JSON.stringify(a);

const COMPANIES = [
  ["Northwind Logistics","northwind.com","Logistics & Supply Chain",2400,"$420M","Chicago, IL",92,["Salesforce","Outreach","6sense","Snowflake"],["Okta","CrowdStrike"],["New VP Sales hire","Series D raise"],"Purchase","Strong"],
  ["Brightwave Health","brightwave.io","Healthcare Technology",780,"$110M","Boston, MA",88,["Salesforce","Gong","Marketo","AWS"],["Okta","Zscaler"],["Expanding sales team","HIPAA audit"],"Decision","Strong"],
  ["Vertex Cloud Systems","vertexcloud.com","Cloud Infrastructure",1500,"$300M","Seattle, WA",95,["Salesforce","Clay","6sense","Gong"],["Duo","Splunk"],["CRO transition","Outbound expansion"],"Purchase","Strong"],
  ["Meridian Financial","meridianfin.com","FinTech",950,"$180M","New York, NY",84,["Salesforce","Outreach","Snowflake"],["Okta","Palo Alto"],["New funding round","Compliance push"],"Decision","Good"],
  ["Cobalt Security","cobaltsec.com","Cybersecurity",520,"$75M","Austin, TX",90,["Salesforce","Gong","Clay","Marketo"],["CrowdStrike","Okta"],["Hiring 10 SDRs","Product launch"],"Purchase","Strong"],
  ["Lumen Retail Group","lumenretail.com","Retail & eCommerce",3200,"$610M","Columbus, OH",71,["Salesforce","6sense","Shopify Plus"],["Zscaler"],["Digital transformation"],"Consideration","Good"],
  ["Apex Manufacturing","apexmfg.com","Industrial Manufacturing",6100,"$1.2B","Detroit, MI",66,["Salesforce","SAP","Outreach"],["Splunk","Duo"],["ERP migration"],"Awareness","Good"],
  ["Skyline Media","skylinemedia.co","Media & Advertising",430,"$60M","Los Angeles, CA",79,["Salesforce","Gong","HubSpot"],["Okta"],["New CMO","Rebrand"],"Consideration","Good"],
  ["Greenfield Energy","greenfield.energy","Clean Energy",1800,"$340M","Denver, CO",82,["Salesforce","Clay","6sense"],["CrowdStrike"],["Govt contract win","Sales expansion"],"Decision","Strong"],
  ["Pinnacle Software","pinnaclesw.com","B2B SaaS",640,"$95M","San Francisco, CA",93,["Salesforce","Outreach","Gong","6sense"],["Okta","Duo"],["Series C raise","Hiring AEs"],"Purchase","Strong"],
  ["Harbor Insurance","harborins.com","InsurTech",1100,"$210M","Hartford, CT",68,["Salesforce","Marketo"],["Zscaler","Okta"],["Legacy system replacement"],"Awareness","Good"],
  ["Quantum Analytics","quantumanalytics.ai","Data & Analytics",380,"$48M","San Jose, CA",87,["Salesforce","Clay","Gong","Snowflake"],["Okta"],["AI product launch","Outbound ramp"],"Decision","Strong"],
  ["Cedar Education","cedaredu.org","EdTech",560,"$70M","Raleigh, NC",63,["Salesforce","HubSpot"],["Duo"],["District expansion"],"Awareness","Fair"],
  ["Atlas Travel","atlastravel.com","Travel & Hospitality",2700,"$480M","Miami, FL",74,["Salesforce","Outreach","6sense"],["Okta"],["Post-pandemic growth","New markets"],"Consideration","Good"],
  ["Ironclad Legal","ironcladlegal.com","LegalTech",290,"$36M","Washington, DC",81,["Salesforce","Gong","Clay"],["CrowdStrike","Okta"],["Funding round","Enterprise push"],"Decision","Strong"],
  ["Solstice Biotech","solsticebio.com","Biotech",870,"$160M","San Diego, CA",77,["Salesforce","Marketo","Snowflake"],["Splunk","Okta"],["FDA milestone","Commercial team build"],"Consideration","Good"],
];

const FIRST=["Sarah","Marcus","Elena","David","Priya","James","Nina","Carlos","Rachel","Tom","Aisha","Kevin","Maria","Daniel","Sophia","Andre","Grace","Victor","Lena","Omar"];
const LAST=["Chen","Reyes","Novak","Okafor","Patel","Sullivan","Brooks","Mendez","Goldberg","Walsh","Khan","Park","Romano","Foster","Bauer","Diallo","Lindqvist","Petrov","Hayes","Adebayo"];
const TITLES=[["VP Sales","Sales"],["RevOps Director","Revenue Operations"],["Chief Revenue Officer","Executive"],["Head of Sales Enablement","Sales"],["SDR Manager","Sales Development"],["VP Marketing","Marketing"]];
const REGION = (loc)=> /CA|WA|OR/.test(loc)?"West": /NY|MA|CT|DC/.test(loc)?"Northeast":"Central";

const accounts=[], contacts=[], calls=[], opportunities=[];
let cid=1, callId=1, oppId=1;

COMPANIES.forEach((c,i)=>{
  const [name,domain,industry,emp,rev,loc,intent,tech,sec,trig,stage,fit]=c;
  const aid=i+1;
  accounts.push({
    id:aid, name, domain, industry, employeeCount:emp, revenue:rev, location:loc, region:REGION(loc),
    intentScore:intent, relationship: intent>=88?"Opportunity": intent>=72?"Prospect":"Target",
    description:`${industry} company; ${emp.toLocaleString()} employees. Runs Salesforce + ${tech.slice(1,3).join(", ")}.`,
    website:`https://${domain}`, linkedinUrl:`https://linkedin.com/company/${domain.split(".")[0]}`,
    techStack:J(tech), securityStack:J(sec), triggerEvents:J(trig),
    sixsenseBuyingStage:stage, sixsenseProfileFit:fit, sfdcAccountId:`acc_${domain.split(".")[0]}_${String(aid).padStart(3,"0")}`,
    createdAt:now, updatedAt:now
  });
  // 2-3 contacts per account
  const nC = 2 + (i%2);
  for(let k=0;k<nC;k++){
    const f=FIRST[(i*3+k)%FIRST.length], l=LAST[(i*5+k)%LAST.length], [title,dept]=TITLES[(i+k)%TITLES.length];
    contacts.push({
      id:cid, accountId:aid, firstName:f, lastName:l, name:`${f} ${l}`, title, dept,
      email:`${f.toLowerCase()}.${l.toLowerCase()}@${domain}`, phone:`555-0${100+cid}`,
      linkedinUrl:`https://linkedin.com/in/${f.toLowerCase()}-${l.toLowerCase()}`, location:loc, department:dept,
      sfdcContactId:`con_${f.toLowerCase()}_${String(cid).padStart(3,"0")}`, createdAt:now, updatedAt:now
    });
    cid++;
  }
  // calls for higher-intent accounts
  if(intent>=78){
    const champ=contacts.filter(x=>x.accountId===aid)[0];
    calls.push({
      id:callId, accountId:aid, contactId:champ.id,
      title:`${name} — Discovery: ${trig[0]}`, duration:1500+(i%5)*300,
      recordingUrl:`https://gong.io/calls/${domain.split(".")[0]}`, transcriptUrl:`https://gong.io/transcripts/${domain.split(".")[0]}`,
      gongCallId:`call_${domain.split(".")[0]}_001`, sentiment: intent>=88?"positive":"neutral",
      keyTopics:J([trig[0], "manual CRM entry", "rep adoption"]), actionItems:J(["Send tailored demo","Loop in RevOps","Share pilot terms"]),
      callDate:iso(Date.parse(now)-i*86400000), createdAt:now, updatedAt:now
    });
    callId++;
  }
  // pipeline for opportunity-grade accounts
  if(intent>=82){
    const amt=(50000+(intent-80)*4000*(1+(i%4))).toFixed(2);
    opportunities.push({
      id:oppId, accountId:aid, name:`${name} — TargetDash ${intent>=90?"Team":"Starter"} Rollout`,
      amount:amt, stage: intent>=92?"Proposal": intent>=88?"Discovery":"Qualification",
      probability: Math.min(85, intent-10), status:"Open",
      expectedCloseDate:iso(Date.parse(now)+(30+i*3)*86400000),
      sfdcOpportunityId:`opp_${domain.split(".")[0]}_001`, aiSuccessScore:Math.min(92,intent-3),
      aiInsights:`Strong buying signals (${stage} stage, ${fit} fit). Trigger: ${trig[0]}. Next best action: send tailored demo to the ${TITLES[(i)%TITLES.length][0]}.`,
      createdAt:now, updatedAt:now
    });
    oppId++;
  }
});

db.accounts=accounts; db.contacts=contacts; db.calls=calls; db.opportunities=opportunities;
const json = JSON.stringify(db, null, 2);
writeFileSync(SEED, json);   // committed canonical seed
writeFileSync(DB, json);     // runtime copy (gitignored) so a running dev server refreshes
console.log(`seeded: ${accounts.length} accounts, ${contacts.length} contacts, ${calls.length} calls, ${opportunities.length} opportunities`);
console.log(`pipeline value: $${opportunities.reduce((s,o)=>s+parseFloat(o.amount),0).toLocaleString()}`);
console.log("wrote demo-db.seed.json (committed) and demo-db.json (runtime)");
