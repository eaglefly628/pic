import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const vault=sqliteTable('vault',{id:text('id').primaryKey(),revision:integer('revision').notNull().default(0),envelope:text('envelope').notNull()});
export const mediaChunks=sqliteTable('media_chunks',{assetId:text('asset_id').notNull(),part:integer('part').notNull(),payload:text('payload').notNull(),iv:text('iv').notNull()},t=>[primaryKey({columns:[t.assetId,t.part]})]);
export const loginLimits=sqliteTable('login_limits',{id:text('id').primaryKey(),failures:integer('failures').notNull().default(0),untilAt:integer('until_at').notNull()});

export const industryItems=sqliteTable('industry_items',{id:text('id').primaryKey(),title:text('title').notNull(),url:text('url').notNull(),summary:text('summary').notNull(),source:text('source').notNull(),category:text('category').notNull(),published:text('published'),collectedAt:text('collected_at').notNull(),disposition:text('disposition').notNull().default('inbox'),zhTitle:text('zh_title'),zhSummary:text('zh_summary'),localizedAt:text('localized_at'),localizationBasis:text('localization_basis')});
export const industryRuns=sqliteTable('industry_runs',{id:text('id').primaryKey(),startedAt:text('started_at').notNull(),completedAt:text('completed_at').notNull(),status:text('status').notNull(),added:integer('added').notNull(),sources:text('sources').notNull()});
export const industrySettings=sqliteTable('industry_settings',{key:text('key').primaryKey(),value:text('value').notNull()});

export const aiIndustryItems=sqliteTable('ai_industry_items',{id:text('id').primaryKey(),title:text('title').notNull(),url:text('url').notNull(),summary:text('summary').notNull(),source:text('source').notNull(),category:text('category').notNull(),published:text('published'),collectedAt:text('collected_at').notNull(),disposition:text('disposition').notNull().default('inbox'),zhTitle:text('zh_title'),zhSummary:text('zh_summary'),localizedAt:text('localized_at'),localizationBasis:text('localization_basis')});
export const aiIndustryRuns=sqliteTable('ai_industry_runs',{id:text('id').primaryKey(),startedAt:text('started_at').notNull(),completedAt:text('completed_at').notNull(),status:text('status').notNull(),added:integer('added').notNull(),sources:text('sources').notNull()});
export const aiIndustrySettings=sqliteTable('ai_industry_settings',{key:text('key').primaryKey(),value:text('value').notNull()});

export const shanghaiEvents=sqliteTable('shanghai_events',{id:text('id').primaryKey(),payload:text('payload').notNull(),firstSeen:text('first_seen').notNull(),updatedAt:text('updated_at').notNull()});
export const shanghaiRuns=sqliteTable('shanghai_runs',{id:text('id').primaryKey(),checkedAt:text('checked_at').notNull(),report:text('report').notNull()});
export const shanghaiSettings=sqliteTable('shanghai_settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const quantCache=sqliteTable('quant_cache',{key:text('key').primaryKey(),payload:text('payload').notNull(),updatedAt:integer('updated_at').notNull()});
export const macroObservations=sqliteTable('macro_observations',{id:integer('id').primaryKey({autoIncrement:true}),seriesId:text('series_id').notNull(),period:text('period').notNull(),payload:text('payload').notNull()});
export const quantResults=sqliteTable('quant_results',{id:text('id').primaryKey(),createdAt:text('created_at').notNull(),payload:text('payload').notNull()});

export const picDevices=sqliteTable('pic_devices',{id:text('id').primaryKey(),publicKey:text('public_key').notNull(),label:text('label').notNull(),revoked:integer('revoked').notNull().default(0)});
