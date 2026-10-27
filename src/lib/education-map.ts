import type {
  AcademicEducationLevelCode,
  EducationLevel,
  InstitutionType,
} from '@/types/database'

export function institutionTypeForEducationCode(
  code: AcademicEducationLevelCode,
): InstitutionType {
  switch (code) {
    case 'junior_secondary':
    case 'senior_secondary':
      return 'secondary'
    case 'university':
      return 'university'
    case 'polytechnic':
      return 'polytechnic'
    case 'college_of_education':
      return 'college_of_education'
    default:
      return 'other'
  }
}

export function isSecondaryEducationCode(code: AcademicEducationLevelCode): boolean {
  return code === 'junior_secondary' || code === 'senior_secondary'
}

/** Map catalogue education level to legacy profiles.education_level */
export function mapAcademicCodeToProfileLevel(
  code: AcademicEducationLevelCode,
): EducationLevel {
  switch (code) {
    case 'junior_secondary':
      return 'middle_school'
    case 'senior_secondary':
      return 'high_school'
    case 'university':
    case 'polytechnic':
    case 'college_of_education':
      return 'undergraduate'
    default:
      return 'other'
  }
}
