--
-- PostgreSQL database dump
--

\restrict SFfMuMy3OeP3V7SKeI6WqxwXZGPfBCe9Chvuc0sX94trH8KLaFuTJXXLsMYA5Dq

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.13 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: EmpleadoRemuneracion; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('8d6b7ce6-5f45-4dad-80fc-4c286bc267b8', '5569e52a-e642-4124-9114-daedfdf0136e', 'ec0cb740-b892-4b99-9e69-c50c5d9f551c', '2026-07', NULL, 1700000.00, 800000.00, 13, 'correccion', 'Reconstruido de los centros de costo al mudar la nómina al legajo. Confirmar.', '2026-07-25 19:23:00.005', '2026-07-25 19:23:00.005');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('812a7861-5c86-437f-8bbc-1ccd2c1655e5', '5569e52a-e642-4124-9114-daedfdf0136e', 'c6c44178-6811-4f71-8d58-1a120a0d6572', '2026-07', NULL, 1500000.00, 750000.00, 13, 'correccion', NULL, '2026-07-25 19:38:16.253', '2026-07-25 19:38:16.253');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('b06092da-be6f-44e5-950a-faf39cefe4b0', '5569e52a-e642-4124-9114-daedfdf0136e', '7e4b7389-8c7b-40d5-87d4-623077848140', '2026-06', '2026-06', 2000000.00, 1000000.00, 13, 'correccion', 'Reconstruido de los centros de costo al mudar la nómina al legajo. Confirmar.', '2026-07-25 19:23:00.005', '2026-07-25 19:38:44.262');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('c002b589-71ad-4648-95e9-f6ca2e67b56e', '5569e52a-e642-4124-9114-daedfdf0136e', '7e4b7389-8c7b-40d5-87d4-623077848140', '2026-07', NULL, 1500000.00, 750000.00, 13, 'correccion', NULL, '2026-07-25 19:38:44.264', '2026-07-25 19:38:44.264');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('d7843e32-f9d0-4110-a051-59878f5d8148', '5569e52a-e642-4124-9114-daedfdf0136e', 'ec0cb740-b892-4b99-9e69-c50c5d9f551c', '2026-06', '2026-06', 1700000.00, 800000.00, 13, 'correccion', 'Reconstruido de los centros de costo al mudar la nómina al legajo. Confirmar.', '2026-07-25 19:23:00.005', '2026-07-25 19:23:00.005');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('84c33439-b0d7-4a4b-9411-bbf5ba0dc3fb', '5569e52a-e642-4124-9114-daedfdf0136e', '3e88d119-e52d-41e1-8a20-89db69c5eb14', '2026-06', '2026-06', 2500000.00, 1000000.00, 13, 'correccion', 'Reconstruido de los centros de costo al mudar la nómina al legajo. Confirmar.', '2026-07-25 19:23:00.005', '2026-07-25 19:36:14.523');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('c4edcdef-a987-43e6-8ff4-173efaf76bb0', '5569e52a-e642-4124-9114-daedfdf0136e', '3e88d119-e52d-41e1-8a20-89db69c5eb14', '2026-07', NULL, 1500000.00, 750000.00, 13, 'correccion', NULL, '2026-07-25 19:36:14.526', '2026-07-25 19:36:14.526');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('4c79c00a-816a-48d1-abfa-a3a0eeecb18f', '5569e52a-e642-4124-9114-daedfdf0136e', '90fae7cb-f935-4d73-9ea2-9344d4e532fb', '2026-06', '2026-06', 1700000.00, 800000.00, 13, 'correccion', 'Reconstruido de los centros de costo al mudar la nómina al legajo. Confirmar.', '2026-07-25 19:23:00.005', '2026-07-25 19:36:49.231');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('affc74e8-6447-475f-8e81-8e0ffda687ae', '5569e52a-e642-4124-9114-daedfdf0136e', '90fae7cb-f935-4d73-9ea2-9344d4e532fb', '2026-07', NULL, 1200000.00, 650000.00, 13, 'correccion', NULL, '2026-07-25 19:36:49.234', '2026-07-25 19:36:49.234');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('4cf6fc8d-a8ef-465f-9155-7381cac1028e', '5569e52a-e642-4124-9114-daedfdf0136e', '46c87230-901b-41d4-b2fb-f4db9de87e6c', '2026-06', '2026-06', 2000000.00, 1000000.00, 13, 'correccion', 'Reconstruido de los centros de costo al mudar la nómina al legajo. Confirmar.', '2026-07-25 19:23:00.005', '2026-07-25 19:37:15.224');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('68422eb7-eee3-4117-b2f0-a78d641f1260', '5569e52a-e642-4124-9114-daedfdf0136e', '46c87230-901b-41d4-b2fb-f4db9de87e6c', '2026-07', NULL, 1500000.00, 750000.00, 13, 'correccion', NULL, '2026-07-25 19:37:15.225', '2026-07-25 19:37:15.225');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('66547f29-306e-4938-8033-cf803cf13066', '5569e52a-e642-4124-9114-daedfdf0136e', 'dba63f90-d9b2-4a5a-bde7-a6dd46f57207', '2026-06', '2026-06', 1700000.00, 800000.00, 13, 'correccion', 'Reconstruido de los centros de costo al mudar la nómina al legajo. Confirmar.', '2026-07-25 19:23:00.005', '2026-07-25 19:37:58.329');
INSERT INTO public."EmpleadoRemuneracion" (id, "tenantId", "empleadoId", "vigenteDesde", "vigenteHasta", "sueldoNeto", "cargasSociales", "sueldosPorAnio", motivo, notas, "createdAt", "updatedAt") VALUES ('360f05a4-5284-4c55-83c5-3a9cfd44a430', '5569e52a-e642-4124-9114-daedfdf0136e', 'dba63f90-d9b2-4a5a-bde7-a6dd46f57207', '2026-07', NULL, 1200000.00, 650000.00, 13, 'correccion', NULL, '2026-07-25 19:37:58.33', '2026-07-25 19:37:58.33');


--
-- PostgreSQL database dump complete
--

\unrestrict SFfMuMy3OeP3V7SKeI6WqxwXZGPfBCe9Chvuc0sX94trH8KLaFuTJXXLsMYA5Dq

